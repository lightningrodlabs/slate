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
  import type { WAL } from "@lightningrodlabs/we-applet";

  const { getStore } :any = getContext("store");
  let store: SlateStore = getStore();

  export let activeBoard: Board
  export let standAlone = false

  $: uiProps = store.uiProps
  $: participants = activeBoard.participants()
  $: activeHashB64 = store.boardList.activeBoardHashB64;
  $: state = activeBoard.readableState()

  let excalidrawAPI = null

  $: if ($state) {
    if (excalidrawAPI) {
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
    store.weClient?.walToPocket(attachment)
  }

  const updateExcalidrawState = throttle((excalidrawElements, excalidrawAppState, excalidrawFiles) => {
    if (getSceneVersion($state.excalidrawElements) !== getSceneVersion(excalidrawElements)) {
      activeBoard.requestChanges([{ type: 'set-excalidraw', excalidrawElements, excalidrawAppState }])
      activeBoard.updateFiles(excalidrawFiles)
    }
  }, 3000, { 'leading': true })

  const embedToolFrame = (element, state) => {
    return React.createElement('iframe', { src: element.link, style: { width: "100%", height: "100%", bgColor: "black"}})
  }

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
          <sl-button slot="trigger"   class="board-button settings" caret>{$state.name}</sl-button>
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
        {#if store.weClient}
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
      {#if $participants}
        <div class="participants">
          <div style="display:flex; flex-direction: row">
            <Avatar agentPubKey={store.myAgentPubKey} showNickname={false} size={30} />

            {#each Array.from($participants.entries()) as [agentPubKey, sessionData]}
            <div class:idle={Date.now()-sessionData.lastSeen >30000}>
              <Avatar agentPubKey={agentPubKey} showNickname={false} size={30} />
            </div>
            {/each}

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


</style>
