<script lang="ts">
    import BoardEditor from './BoardEditor.svelte';
    import type { SlateStore } from './store';
    import { getContext } from 'svelte';
    import type { BoardProps } from './board';
    import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
    import '@shoelace-style/shoelace/dist/components/button/button.js';
    import type SlDialog from '@shoelace-style/shoelace/dist/components/dialog/dialog';
    let dialog: SlDialog

    const { getStore } :any = getContext('store');

    const store:SlateStore = getStore();

    const addBoard = async (name: string, props: BoardProps) => {
        // @ts-ignore
        const board = await store.boardList.makeBoard({name, props})
        store.setUIprops({showMenu:false})
        dialog.hide()
        await store.boardList.setActiveBoard(board.hash)
    }
    export const open = ()=> {
        boardEditor.reset()
        dialog.show()
    }
    let boardEditor

</script>
<sl-dialog bind:this={dialog} label="New Canvas"
    on:sl-initial-focus={(e)=>{
        boardEditor.initialFocus()
        e.preventDefault()
    }}
    on:sl-request-close={(event)=>{
        if (event.detail.source === 'overlay') {
        event.preventDefault();
  }}}>
    <BoardEditor bind:this={boardEditor}  handleSave={addBoard} cancelEdit={()=>dialog.hide()} />
</sl-dialog>
