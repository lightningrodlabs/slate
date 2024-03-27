<script lang="ts">
  import "@shoelace-style/shoelace/dist/components/skeleton/skeleton.js";
  import { createEventDispatcher, getContext } from "svelte";
  import type { SlateStore } from "./store";
  import type { WAL } from "@lightningrodlabs/we-applet";
  import SvgIcon from "./SvgIcon.svelte";

  const dispatch = createEventDispatcher()

  export let attachments: Array<WAL>
  export let allowDelete = true

  const { getStore } :any = getContext("store");
  let store: SlateStore = getStore();

</script>
<div class="attachments-list">
  {#each attachments as attachment, index}
    <div
      class:attachment-item-with-delete={allowDelete}
      class:attachment-item={!allowDelete}
    >
      {#await store.weClient.assetInfo(attachment)}
        <sl-button size="small" loading></sl-button>
      {:then { assetInfo }}
        <sl-button  size="small"
          on:click={(e)=>{
              e.stopPropagation()
              store.weClient.openWal(attachment)
            }}
          style="display:flex;flex-direction:row;margin-right:5px"><sl-icon src={assetInfo.icon_src} slot="prefix"></sl-icon>
          {assetInfo.name}
        </sl-button>
        {#if allowDelete}
          <sl-button size="small"
            on:click={()=>{
              dispatch("remove-attachment",index)
            }}
          >
            <SvgIcon icon=faTrash size=12 />
          </sl-button>
        {/if}
      {:catch error}
        Oops. something's wrong.
      {/await}
    </div>
  {/each}
</div>
<style>
  .attachments-list {
    display:flex;
    flex-direction:row;
    flex-wrap: wrap;
  }
  .attachment-item {
  }
  .attachment-item-with-delete {
    border:1px solid #aaa;
    background-color:rgba(0,255,0,.1);
    padding:4px;
    display:flex;
    margin-right:4px;
    border-radius:4px;
  }
</style>