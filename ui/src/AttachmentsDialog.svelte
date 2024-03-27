<script lang="ts">
  import { isWeContext, type WAL, weaveUrlFromWal } from "@lightningrodlabs/we-applet";
  import { cloneDeep } from "lodash";
  import type { Board } from "./board";
  import { getContext } from "svelte";
  import type { SlateStore } from "./store";
  import '@shoelace-style/shoelace/dist/components/button/button.js';
  import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
  import AttachmentsList from "./AttachmentsList.svelte";
  import AttachmentsBind from "./AttachmentsBind.svelte";
  import SvgIcon from "./SvgIcon.svelte";

  const { getStore } :any = getContext("store");
  let store: SlateStore = getStore();
  //let card: Card | undefined
  let attachments: Array<WAL> = []

  $:attachments = attachments

  export let activeBoard: Board
  export const close=()=>{dialog.hide()}
  export const open= async (c: any)=>{
    // card = c
    // if (card) {
    //   attachments = card.props.attachments ? cloneDeep(card.props.attachments): []
    // } else {
      attachments = activeBoard.state().props.attachments
    // }
    await bind.refresh()
    dialog.show()
  }
  let dialog
  $: attachments
  let bind

  function removeAttachment(index: number) {
    attachments.splice(index, 1);
    attachments = attachments
    handleSave()
  }

  const addAttachment = async () => {
    const wal = await store.weClient.userSelectWal()
    if (wal) {
      _addAttachment(wal)
    }
  }

  const _addAttachment = (wal: WAL) => {
    attachments.push(wal)
    attachments = attachments
    handleSave()
  }

  const handleSave = async () => {
    // if (card) {
    //   const props = cloneDeep(card.props)
    //   props.attachments = cloneDeep(attachments)
    //   activeBoard.requestChanges([{
    //     type: 'update-card-props',
    //     id: card.id,
    //     props
    //   }])
    // } else {
      const props = cloneDeep(activeBoard.state().props)
      props.attachments = cloneDeep(attachments)
      activeBoard.requestChanges([{type: 'set-props', props }])
    // }
  }
</script>

<sl-dialog label={"Board Links"} bind:this={dialog}>
  {#if isWeContext()}
  <AttachmentsList attachments={attachments}
      on:remove-attachment={(e)=>removeAttachment(e.detail)}/>

  <div>
      <h3>Search Linkables:</h3>
  </div>
  <sl-button style="margin-top:5px;margin-right: 5px" circle on:click={()=>addAttachment()} >
        <SvgIcon icon=link size=12 />
  </sl-button>

  <AttachmentsBind
      bind:this = {bind}
      activeBoard={activeBoard}
      on:add-binding={(e)=>_addAttachment(e.detail)}
      />

  {/if}
</sl-dialog>

<style>


  sl-dialog::part(panel) {
      background: #FFFFFF;
      border: 2px solid rgb(166 115 55 / 26%);
      border-bottom: 2px solid rgb(84 54 19 / 50%);
      border-top: 2px solid rgb(166 115 55 / 5%);
      box-shadow: 0px 15px 40px rgb(130 107 58 / 35%);
      border-radius: 10px;
  }
</style>