<script lang="ts">
  import { type WAL, isWeaveContext, weaveUrlFromWal } from "@theweave/api";
  import { cloneDeep } from "lodash";
  import type { Board, Sticky } from "./board";
  import { getContext } from "svelte";
  import type { TalkingStickiesStore } from "./store";
  import type { WALUrl} from "./util";
  import '@shoelace-style/shoelace/dist/components/button/button.js';
  import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
  import AttachmentsList from "./AttachmentsList.svelte";
  import SvgIcon from "./SvgIcon.svelte";

  const { getStore } :any = getContext("store");
  let store: TalkingStickiesStore = getStore();
  let sticky: Sticky | undefined
  let attachments: Array<WALUrl> = []
 
  $:attachments = attachments

  export let activeBoard: Board
  export const close=()=>{dialog.hide()}
  export const open= async (c: Sticky)=>{
    sticky = c
    if (sticky) {
      attachments = sticky.props.attachments ? cloneDeep(sticky.props.attachments): []
    } else {
      attachments = activeBoard.state().props.attachments
    }
    dialog.show()
  }
  let dialog

  function removeAttachment(index: number) {
    attachments.splice(index, 1);
    attachments = attachments
    handleSave()
  }

  const addAttachment = async () => {
    const hrl = await store.weaveClient.assets.userSelectAsset()
    if (hrl) {
      _addAttachment(hrl)
    }
  }

  const _addAttachment = (wal: WAL) => {
    attachments.push(weaveUrlFromWal(wal))
    attachments = attachments
    handleSave()
  }

  const handleSave = async () => {
    if (sticky) {
      const props = cloneDeep(sticky.props)
      props.attachments = cloneDeep(attachments)
      activeBoard.requestChanges([{
        type: 'update-sticky-props', 
        id: sticky.id,
        props
      }])
    } else {
      const props = cloneDeep(activeBoard.state().props)
      props.attachments = cloneDeep(attachments)
      activeBoard.requestChanges([{type: 'set-props', props }])
    }
  }
</script>

<sl-dialog label={sticky? "Sticky Links":"Board Links"} bind:this={dialog}>
  {#if isWeaveContext()}
  <AttachmentsList attachments={attachments}
      on:remove-attachment={(e)=>removeAttachment(e.detail)}/>

  <div style="">
      <h3>Search Linkables:</h3> 
      <sl-button style="margin-top:5px;margin-right: 5px" circle on:click={()=>addAttachment()} >
        <SvgIcon icon=searchPlus size=30 />
  </sl-button>
  </div> 
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