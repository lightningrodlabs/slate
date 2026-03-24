<script lang="ts">
  import React from 'react';
  import ReactDOM from 'react-dom';
  import { getContext, afterUpdate, onMount } from "svelte";
  import type { SlateStore } from "./store";
  import { v1 as uuidv1 } from "uuid";
  import { fromUint8Array } from "js-base64";
  import type {  Board, BoardProps } from "./board";
  import EditBoardDialog from "./EditBoardDialog.svelte";
  import Avatar from "./Avatar.svelte";
  import { decodeHashFromBase64, type Timestamp } from "@holochain/client";
  import { cloneDeep, throttle } from "lodash";
  import '@shoelace-style/shoelace/dist/components/dropdown/dropdown.js';
  import '@shoelace-style/shoelace/dist/components/textarea/textarea.js';
  import ClickEdit from "./ClickEdit.svelte";
  import { onVisible } from "./util";
  import SvgIcon from "./SvgIcon.svelte";
  import { exportBoard } from "./export";
  import AttachmentsList from './AttachmentsList.svelte';
  import AttachmentsDialog from "./AttachmentsDialog.svelte"
  import { Excalidraw, getSceneVersion } from "@excalidraw/excalidraw";
  import ReactAdapter from "./ReactAdapter.svelte";
  import AboutDialog from "./AboutDialog.svelte";
  import type { WAL } from "@theweave/api";
  import '@holochain-syn/core/dist/elements/session-participants.js'

  const { getStore } :any = getContext("store");
  let store: SlateStore = getStore();

  export let activeBoard: Board
  export let standAlone = false

  $: uiProps = store.uiProps
  $: participants = activeBoard.participants()
  $: activeHashB64 = store.boardList.activeBoardHashB64;
  $: state = activeBoard.readableState()
  $: session = activeBoard.session
  $: sessionStatus = session.sessionStatus

  let excalidrawAPI = null
  let isUserActivelyEditing = false
  let hasUnsavedChanges = false

  $: if ($state) {
    if (excalidrawAPI && !isUserActivelyEditing) {
      // Only update the canvas from remote changes if the user is not actively editing
      console.log('Remote changes detected, updating Excalidraw canvas...', isUserActivelyEditing, $state.excalidrawElements.length);
      // XXX: Need to do a cloneDeep here too otherwise resizing elements doesn't trigger
      //      updateExcalidrawState because it must be editing the $state.excalidrawElements directly and so the scene # is updated internally
      excalidrawAPI.updateScene({
        elements: cloneDeep($state.excalidrawElements),
        // appState: $state.excalidrawAppState
      })
      if ($state.excalidrawFileHashes) {
        const currentFiles = excalidrawAPI.getFiles()
        const currentExcalidrawFileIds = Object.keys(currentFiles) // ids from excalidraw => hash from file storage
        const stateFileIds = Object.keys($state.excalidrawFileHashes)
        const newFileIds = stateFileIds.filter((id) => !currentExcalidrawFileIds.includes(id))
        for (const id of newFileIds) {
          const hash = decodeHashFromBase64($state.excalidrawFileHashes[id])
          tryToDownloadFile(id, hash)
        }
      }
    }
  }

  onMount(async () => {
    console.log('mounted', excalidrawAPI, $state)
	});

  const setExcalidrawAPI = (api) => {
    excalidrawAPI = api
  }

  const tryToDownloadFile = async (id, fileHash, tries = 1) => {
    try {
      const file = await activeBoard.fileStorageClient.downloadFile(fileHash)
      file.arrayBuffer().then(data => {
        const dataArray = new Uint8Array(data)
        const dataURL = `data:${file.type};base64,${fromUint8Array(dataArray)}`
        excalidrawAPI.addFiles([{ id, dataURL, mimeType: file.type, created: file.lastModified }])
      })
    } catch (e) {
      if (tries < 5) {
        setTimeout(() => tryToDownloadFile(id, fileHash, tries + 1), 500)
      } else {
        console.log("Failed to downloading file", e)
      }
    }
  }

  // afterUpdate(() => {
  //   // TODO: why is this being called so much?
	// 	console.log(' afterUpdate', $state.excalidrawElements, getSceneVersion($state.excalidrawElements));
	// });

  const closeBoard = async () => {
    await store.closeActiveBoard(false);
  };

  const leaveBoard = async () => {
    await store.closeActiveBoard(true);
  };

  let editBoardDialog

  const close = ()=> {
  }

  const doFocus = (node) => {
    // otherwise we get an error from the shoelace element
    setTimeout(() => {
      node.focus()
    }, 50);
  }

  let attachmentsDialog : AttachmentsDialog

  const walToPocket = () => {
    const attachment: WAL = { hrl: [store.dnaHash, activeBoard.hash], context: "" }
    store.weaveClient?.assets?.assetToPocket(attachment)
  }

  const checkIfUserIsActivelyEditing = (appState) => {
    // Detect if user is actively creating, editing, or manipulating objects
    const isEditing = (
      appState.editingElement !== null ||           // Creating/drawing a new element
      appState.resizingElement !== null ||          // Resizing an element
      appState.editingLinearElement !== null ||     // Editing a line/arrow
      appState.draggingElement !== null ||          // Dragging to create
      appState.editingGroupId !== null ||           // Editing text or group
      appState.isResizing === true ||               // Resizing state (check for true explicitly)
      appState.isDragging === true                  // Dragging state (check for true explicitly)
    )
    return isEditing
  }

  const saveExcalidrawChanges = throttle(async (excalidrawElements, excalidrawAppState, excalidrawFiles) => {
    // console.log('Throttled saveExcalidrawChanges called', getSceneVersion($state.excalidrawElements), getSceneVersion(excalidrawElements));
    if (getSceneVersion($state.excalidrawElements) !== getSceneVersion(excalidrawElements)) {
      await activeBoard.requestChanges([{ type: 'set-excalidraw', excalidrawElements, excalidrawAppState }])
      await activeBoard.updateFiles(excalidrawFiles)
      // Check if user is still editing after save
      isUserActivelyEditing = checkIfUserIsActivelyEditing(excalidrawAppState)
    }
  }, 3000, { 'leading': true, 'trailing': true })

  const updateExcalidrawState = (excalidrawElements, excalidrawAppState, excalidrawFiles) => {
    // Check editing state immediately (not throttled)
    const currentlyEditing = checkIfUserIsActivelyEditing(excalidrawAppState)
    
    if (currentlyEditing) {
      isUserActivelyEditing = true
    } else if (isUserActivelyEditing) {
      // Throttled save to Syn
      saveExcalidrawChanges(excalidrawElements, excalidrawAppState, excalidrawFiles)
    }
    
  }

  const embedToolFrame = (element, state) => {
    return React.createElement('iframe', { src: element.link, style: { width: "100%", height: "100%", bgColor: "black"}})
  }

  // Hidden feature: Ctrl click counter
  let ctrlClickCount = 0
  let showHiddenButton = false
  let autoEditActive = false
  let autoEditIntervalId: ReturnType<typeof setInterval> | null = null

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Control' || event.key === 'Ctrl') {
      ctrlClickCount++
      if (ctrlClickCount >= 9) {
        showHiddenButton = true
      }
      // Reset counter after 2 seconds of no Ctrl presses
      setTimeout(() => {
        ctrlClickCount = 0
      }, 2000)
    }
  }

  const autoEdit = async () => {
    isUserActivelyEditing = true // Prevent remote updates during auto edit

    // Use the Excalidraw API directly instead of simulating events
    if (excalidrawAPI) {
      console.log('Using Excalidraw API to create rectangle')
      const id = uuidv1()
      const centerX = 400 + (Math.random() - 0.5) * 600
      const centerY = 400 + (Math.random() - 0.5) * 600
      const width = 200
      const height = 100
      
      const rectangle = {
        id: id,
        type: 'rectangle',
        x: centerX - width / 2,
        y: centerY - height / 2,
        width: width,
        height: height,
        angle: 0,
        strokeColor: '#000000',
        backgroundColor: 'transparent',
        fillStyle: 'hachure',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 1,
        opacity: 100,
        groupIds: [],
        roundness: { type: 3 },
        seed: Math.floor(Math.random() * 100000),
        version: 1,
        versionNonce: Math.floor(Math.random() * 100000),
        isDeleted: false,
        boundElements: null,
        updated: Date.now(),
        link: null,
        locked: false,
      }
      
      const currentElements = excalidrawAPI.getSceneElements()
      excalidrawAPI.updateScene({
        elements: [...currentElements, rectangle]
      })
      console.log('Rectangle created via API:', rectangle)
    } else {
      console.error('Excalidraw API not available')
    }
  }

  function getTimeAgo(stringDate: string, _currentTime?: number) {
    try {
      const timeAgo = store.timeAgo;
      const date = new Date(`${stringDate}`);
      return timeAgo.format(date);
    } catch (e) {
      return "";
    }
  }

  const toggleAutoEdit = () => {
    autoEditActive = !autoEditActive
    if (autoEditActive) {
      // Start the loop
      autoEditIntervalId = setInterval(() => {
        autoEdit()
      }, 5000) // Run every 2 seconds
    } else {
      // Stop the loop
      if (autoEditIntervalId !== null) {
        clearInterval(autoEditIntervalId)
        autoEditIntervalId = null
      }
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (autoEditIntervalId !== null) {
        clearInterval(autoEditIntervalId)
      }
    }
  })

</script>
<div class="board" >

  <div class="background">
    <div class="background-overlay"></div>
    <div class="background-image"
      style={$state.props.bgUrl ? `background-size:cover; background-image: url(${encodeURI($state.props.bgUrl)})`: ""}></div>
  </div>

  <EditBoardDialog bind:this={editBoardDialog}></EditBoardDialog>
  <div class="top-bar">
    <div class="left-items">
      {#if standAlone}
        <h2>{$state.name}</h2>
      {:else}
        <sl-button  class="board-button close" on:click={closeBoard} title="Close">
          <SvgIcon icon=faClose size="16px"/>
        </sl-button>
        <sl-dropdown class="board-options board-menu" skidding=15>
          <sl-button slot="trigger" class="board-button settings" caret>{$state.name}</sl-button>
          <sl-menu className="settings-menu">
            <sl-menu-item on:click={()=> editBoardDialog.open(cloneDeep(activeBoard.hash))} class="board-settings" >
                <SvgIcon icon="faCog"  style="background: transparent; opacity: .5; position: relative; top: -2px;" size="14px"/> <span>Settings</span>
            </sl-menu-item>
            <sl-menu-item on:click={() => exportBoard($state)} title="Export" class="board-export" >
              <SvgIcon icon="faFileExport"  style="background: transparent; opacity: .5; position: relative; top: -2px;" size="14px" /> <span>Export</span>
            </sl-menu-item>
            <sl-menu-item on:click={() => {
              store.archiveBoard(activeBoard.hash)
              }} title="Archive" class="board-archive" >
              <SvgIcon icon="faArchive" style="background: transparent; opacity: .5; position: relative; top: -2px;" size="14px" /> <span>Archive</span>
            </sl-menu-item>
            <sl-menu-item  on:click={leaveBoard} class="leave-board" >
                <SvgIcon icon="faArrowTurnDown" style="background: transparent; opacity: .5; position: relative; top: -2px;" size="12px" /> <span>Leave Canvas</span>
            </sl-menu-item>
          </sl-menu>
        </sl-dropdown>
        {#if store.weaveClient}
          <AttachmentsDialog activeBoard={activeBoard} bind:this={attachmentsDialog}></AttachmentsDialog>
          {#if $state.boundTo.length>0}
            <div style="margin-left:10px;display:flex; align-items: center">
              <span style="margin-right: 5px;">Bound To:</span>
              <AttachmentsList allowDelete={false} attachments={$state.boundTo} />
            </div>
          {/if}
          <div style="margin-left:10px; margin-top:2px;display:flex">
            <button title="Add Board to Pocket" class="attachment-button" style="margin-right:10px" on:click={()=>walToPocket()} >
              <SvgIcon icon="addToPocket" size="20px"/>
            </button>
            <button title="Manage Board Attachments" class="attachment-button" style="margin-right:10px" on:click={()=>attachmentsDialog.open(undefined)} >
              <SvgIcon icon="link" size="20px"/>
            </button>
            {#if $state.props.attachments}
              <AttachmentsList attachments={$state.props.attachments}
                allowDelete={false}/>
            {/if}
          </div>
        {/if}

      {/if}
    </div>
    <div class="right-items">
      {#if showHiddenButton}
        <button 
          class="hidden-auto-edit-button {autoEditActive ? 'active' : ''}" 
          on:click={toggleAutoEdit}
          title={autoEditActive ? 'Stop Auto Edit' : 'Start Auto Edit'}
        >
          {autoEditActive ? '⏹' : '▶'}
        </button>
        ({isUserActivelyEditing ? 'Editing' : 'Saved'})
      {/if}

      <span 
        style="display: flex; margin-right:10px; cursor: pointer"
        class={$sessionStatus.code == "syncing" ? "spinning" : ""}
        title={$sessionStatus.code == "error" ? $sessionStatus.error : ($sessionStatus.code == "syncing" ? "syncing..." : "Last save " + getTimeAgo($sessionStatus.lastSave))}
      >

        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" 
          fill={$sessionStatus.code == "ok" ? "#2de273ff" : $sessionStatus.code == "error" ? "#df3c1f" : "#f09928"}
        >
        <path d="M160-160v-80h110l-16-14q-52-46-73-105t-21-119q0-111 66.5-197.5T400-790v84q-72 26-116 88.5T240-478q0 45 17 87.5t53 78.5l10 10v-98h80v240H160Zm400-10v-84q72-26 116-88.5T720-482q0-45-17-87.5T650-648l-10-10v98h-80v-240h240v80H690l16 14q49 49 71.5 106.5T800-482q0 111-66.5 197.5T560-170Z"/>
        </svg>

        <span style="color: #df3c1f;">
          {$sessionStatus.code == "error" ? `error syncing` : ""}
        </span>
      </span>
      {#if $participants}
        <div class="participants">
          <div style="display:flex; flex-direction: row; margin: 3px 0;">
            <session-participants direction="row" showOffline={true} sessionstore={session} />
          </div>
        </div>
      {/if}

    </div>
  </div>
  {#if $state && $state.excalidrawElements}
    <div class='excalidraw-wrapper'>
      <ReactAdapter
        el={Excalidraw}
        class="excalidraw"
        excalidrawAPI={setExcalidrawAPI}
        initialData={{ elements: $state.excalidrawElements, appState: {} }}
        onChange={updateExcalidrawState}
        renderEmbeddable={(element, appState) => { return embedToolFrame(element, state) }}
        validateEmbeddable={(link) => { return true }}
      />
    </div>
  {/if}
  <div class="bottom-fade"></div>
</div>
<style>
  .background {
    position: absolute;
    z-index: 0;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  .background-overlay {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.87) 0%, rgba(148, 179, 205, 0.78) 100%);
    position: absolute;
    z-index: 2;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    opacity: .8;
  }

  .background-image {
    position: absolute;
    z-index: 1;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    background-size: cover;
  }

  .board {
    display: flex;
    flex-direction: column;
    background: transparent;
    border-radius: 0;
    min-height: 0;
    overflow-x: auto;
    width: 100%;
    position: relative;
    max-height: calc(100vh - 50px);
  }
  .top-bar {
    box-shadow: 0px 10px 15px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    background-color: #fff;
    padding-left: 10px;
    padding-right: 10px;
    border-radius: 0;
    position: sticky;
    width: 100%;
    top: 0;
    left: 0;
    z-index: 200;
    color: white
  }
  .left-items {
    display: flex;
    align-items: center;
  }
  .right-items {
    display: flex;
    align-items: center;
  }

  sl-button.board-button::part(base) {
    background-color: transparent;
  }

  .board-button.close {
    margin-left: 0;
    margin-right: 5px;
  }

  .board-button.close::part(base) {
    font-size: 16px;
    line-height: 36px;
  }

  .right-items .board-button::part(base) {
    font-size: 24px;
  }

  .board-button {
    margin-left: 10px;
  }

  .board-button.settings {
    width: auto;
    margin-left: 0;
  }
  .board-options .board-settings {
    width: 100%;
    position: relative;
  }
  .board-options .board-settings span, .board-export span, .board-archive span, .board-options .leave-board span, .board-options .participants span {
    font-size: 16px;
    font-weight: bold;
  }

  .board-button.settings:hover {
    transform: scale(1.1);
  }

  .board-button.settings::part(base) {
    width: auto;
    font-size: 18px;
    font-weight: bold;
    color: rgba(86, 92, 108, 1.0);
  }

  .board-button.settings::part(label) {
    padding: 0 0 0 0;
    height: 36px;
    line-height: 36px;
  }

  .board-button.settings:hover {
    opacity: 1;
  }

  .board-button::part(base) {
    border: none;
    padding: 0;
    margin: 0;
  }

  .board-button {
    width: 30px;
    height: 30px;
    background: #FFFFFF;
    border: 1px solid rgba(35, 32, 74, 0.1);
    box-shadow: 0px 4px 4px rgba(66, 66, 66, 0.1);
    border-radius: 5px;
    padding: 5px 10px;
    display: flex;
    transform: scale(1);
    align-items: center;
    justify-content: center;
    transition: all .25s ease;
  }

  .board-button:hover {
    transform: scale(1.25);
  }

  .board-button:active {
    box-shadow: 0px 8px 10px rgba(53, 39, 211, 0.35);
    transform: scale(1.1);
  }

  sl-menu-item::part(checked-icon) {
    display: none;
  }

  sl-menu-item::part(base) {
    padding-left: 8px;
  }

  .bottom-fade {
    position: fixed;
    bottom: 0;
    z-index: 100;
    width: 100%;
    height: 20px;
    bottom: 10px;
    background: linear-gradient(180deg, rgba(189, 209, 230, 0) 0%, rgba(102, 138, 174, 0.81) 100%);
    opacity: 0.4;
  }

  .board::-webkit-scrollbar {
    height: 10px;
    background-color: transparent;
  }

  .board::-webkit-scrollbar-thumb {
    border-radius: 0 0 0 0;
    background: rgba(20,60,119,.7);
    /* background: linear-gradient(180deg, rgba(20, 60, 119, 0) 0%, rgba(20,60,119,.6) 100%); */
  }

  .excalidraw-wrapper {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .excalidraw {
    width: 100%;
    height: 100%;
  }

  :global(.attachment-button) {
    width: 30px;
    height: 30px;
    padding: 4px;
    border-radius: 50%;
    border: 1px solid rgba(235, 235, 238, 1.0);
    background-color: rgba(255,255,255,.8);
  }
  :global(.attachment-button:hover) {
    transform: scale(1.25);
  }

  .idle {
    opacity: 0.5;
  }

  .hidden-auto-edit-button {
    width: 40px;
    height: 40px;
    margin-right: 10px;
    border-radius: 50%;
    border: 2px solid rgba(86, 92, 108, 0.5);
    background-color: rgba(255, 255, 255, 0.9);
    font-size: 18px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .hidden-auto-edit-button:hover {
    transform: scale(1.1);
    border-color: rgba(86, 92, 108, 0.8);
  }

  .hidden-auto-edit-button.active {
    background-color: rgba(255, 100, 100, 0.9);
    border-color: rgba(200, 50, 50, 0.8);
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }


</style>
