<script>
  import React from "react";
  import ReactDOM from "react-dom";
  import { onDestroy, onMount } from "svelte";

  const e = React.createElement;
  let container;

  onMount(() => {
    const { el, children, class: _, ...props } = $$props;
    try {
      ReactDOM.render(e(el, props, children), container);
    } catch (err) {
      console.warn(`react-adapter failed to mount.`, { err });
    }
  });

  onDestroy(() => {
    try {
      ReactDOM.unmountComponentAtNode(container);
    } catch (err) {
      console.warn(`react-adapter failed to unmount.`, { err });
    }
  });
</script>

<div bind:this={container} class={$$props.class} />