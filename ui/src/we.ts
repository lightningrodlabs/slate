import { DocumentStore, SynClient, SynStore, WorkspaceStore } from '@holochain-syn/core';
import type { BoardEphemeralState, BoardState } from './board';
import { asyncDerived, pipe, sliceAndJoin, toPromise } from '@holochain-open-dev/stores';
import { BoardType } from './boardList';
import { LazyHoloHashMap } from '@holochain-open-dev/utils';
import type { AppletHash, AppletServices, AssetInfo, RecordInfo, WAL, WeaveServices } from '@lightningrodlabs/we-applet';
import { getMyDna } from './util';
import type { AppClient, RoleName, ZomeName } from '@holochain/client';

const ROLE_NAME = "slate"
const ZOME_NAME = "syn"

const BOARD_ICON_SRC = `data:image/svg+xml;utf8,
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="black" version="1.1" id="Capa_1" width="800px" height="800px" viewBox="0 0 83.227 83.227" xml:space="preserve">
<g>
	<g>
		<path d="M56.759,39.007V12.615c0-1.541-1.256-2.795-2.795-2.795H2.795C1.253,9.82,0,11.074,0,12.615v31.229v6.475    c0,1.541,1.254,2.795,2.795,2.795h16.134c-0.005,0.062-0.017,0.121-0.017,0.184v8.14c0,1.2,0.883,2.184,1.968,2.184h14.996    c1.085,0,1.968-0.979,1.968-2.184v-8.14c0-0.062-0.012-0.121-0.017-0.184h16.135c0.42,0,0.827-0.104,1.2-0.283l17.66,18.93    c1.062,1.063,2.494,1.646,4.037,1.646l0,0c1.646,0,3.281-0.688,4.482-1.891c2.418-2.416,2.525-6.24,0.23-8.537L56.759,39.007z     M49.641,39.792l4.281,3.961l-2.002,2.668l-2.543-2.729l-3.371-3.615l4.412-4.413l4.645,4.483l0,0l0.904,0.876l-0.838,1.118    L51,38.32c-0.404-0.375-1.039-0.353-1.412,0.056C49.216,38.783,49.238,39.417,49.641,39.792z M49.035,31.592    c-0.219,1.915-1.18,3.81-2.707,5.336c-1.75,1.749-3.983,2.752-6.131,2.752l0,0c-1.518,0-2.824-0.503-3.777-1.456    c-0.846-0.846-1.343-1.993-1.437-3.316c-0.01-0.138-0.048-0.272-0.113-0.395c-3.036-5.761-6.713-7.701-9.026-8.348    c3.303-2.827,6.762-4.258,10.304-4.258c6.614,0,11.405,5.036,11.475,5.112C48.744,28.139,49.244,29.763,49.035,31.592z     M1.999,12.615c0-0.438,0.357-0.795,0.795-0.795h51.167c0.438,0,0.795,0.356,0.795,0.795v24.459l-3.654-3.529    c-0.109-0.107-0.242-0.175-0.381-0.221c0.139-0.497,0.244-0.999,0.301-1.504c0.281-2.448-0.424-4.655-1.959-6.188    c-0.217-0.233-5.41-5.724-12.915-5.724c-4.634,0-9.082,2.099-13.221,6.237c-0.295,0.295-0.343,0.743-0.169,1.123    c0.174,0.38,0.6,0.612,1.015,0.58c0.882,0,5.441,0.36,9.233,7.42c0.167,1.72,0.856,3.227,2,4.37    c1.317,1.317,3.161,2.042,5.19,2.042c0,0,0,0,0.001,0c1.28,0,2.575-0.285,3.813-0.809l1.838,1.971H1.998L1.999,12.615    L1.999,12.615z M35.801,61.615l-14.825,0.027c-0.013-0.012-0.063-0.082-0.063-0.211v-1.498h14.932v1.498    C35.844,61.521,35.82,61.584,35.801,61.615z M35.844,53.295v4.642H20.912v-4.642c0-0.104,0.034-0.17,0-0.184h14.885    C35.817,53.143,35.844,53.195,35.844,53.295z M35.876,51.113H20.88H2.795C2.357,51.113,2,50.758,2,50.318v-5.477h45.715    l5.848,6.27H35.876V51.113z M79.93,70.102c-0.828,0.828-1.947,1.305-3.068,1.305c-1.01,0-1.938-0.377-2.602-1.035L56.031,50.828    c0-0.002,0-0.004-0.002-0.004l-2.723-2.918l2.094-2.789l14.027,12.98c0.189,0.178,0.438,0.266,0.68,0.266    c0.271,0,0.535-0.105,0.732-0.32c0.375-0.402,0.354-1.037-0.057-1.412L56.604,43.51l0.813-1.082l22.758,21.979    C81.678,65.908,81.568,68.465,79.93,70.102z"/>
	</g>
</g>
</svg>`

export const appletServices: AppletServices = {
    // Types of attachment that this Applet offers for other Applets to be created
    creatables: {
      'board': {
        label: "Board",
        icon_src: BOARD_ICON_SRC,
      }
    },
    bindAsset: async (appletClient: AppClient,
      srcWal: WAL, dstWal: WAL): Promise<void> => {
      console.log("Bind requested.  Src:", srcWal, "  Dst:", dstWal)
    },
    // Types of UI widgets/blocks that this Applet supports
    blockTypes: {
      'active_boards': {
        label: 'Active Boards',
        icon_src:
        `<svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 512 512"><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M0 96C0 60.7 28.7 32 64 32H448c35.3 0 64 28.7 64 64V416c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V96zm64 0v64h64V96H64zm384 0H192v64H448V96zM64 224v64h64V224H64zm384 0H192v64H448V224zM64 352v64h64V352H64zm384 0H192v64H448V352z"/></svg>`,
        view: "applet-view",
      },
    },
    getAssetInfo: async (
      appletClient: AppClient,
      wal: WAL,
      recordInfo: RecordInfo
    ): Promise<AssetInfo | undefined> => {
      if (recordInfo) {
        const roleName: RoleName = recordInfo.roleName
        // const integrityZomeName: ZomeName = recordInfo.integrityZomeName
        const entryType: string = recordInfo.entryType

        if (entryType == "document") {
          const synClient = new SynClient(appletClient, roleName, ZOME_NAME);
          const synStore = new SynStore(synClient);
          const documentHash = wal.hrl[1]
          const docStore = new DocumentStore<BoardState, BoardEphemeralState> (synStore, documentHash)
          const workspaces = await toPromise(docStore.allWorkspaces)
          const workspace = new WorkspaceStore(docStore, Array.from(workspaces.keys())[0])
          const latestSnapshot = await toPromise(workspace.latestSnapshot)


          return {
            icon_src: BOARD_ICON_SRC,
            name: latestSnapshot.name,
          };
        } else {
          throw new Error("unknown entry type:"+ entryType)
        }
      } else {
        throw new Error("Null WAL not supported, must supply a recordInfo")
      }
    },
    search: async (
      appletClient: AppClient,
      appletHash: AppletHash,
      weaveServices: WeaveServices,
      searchFilter: string
    ): Promise<Array<WAL>> => {
        const synClient = new SynClient(appletClient, ROLE_NAME, ZOME_NAME);
        const synStore = new SynStore(synClient);
        const boardHashes = asyncDerived(synStore.documentsByTag.get(BoardType.active),x=>Array.from(x.keys()))

        const boardData = new LazyHoloHashMap( documentHash => {
            const docStore = synStore.documents.get(documentHash)

            const workspace = pipe(docStore.allWorkspaces,
                workspaces => {
                    return new WorkspaceStore(docStore, Array.from(workspaces.keys())[0])
                }
            )
            const latestState = pipe(workspace,
                w => w.latestSnapshot
                )
            return latestState
        })

        const allBoardsAsync = pipe(boardHashes,
            docHashes => sliceAndJoin(boardData, docHashes)
        )

        const allBoards = Array.from((await toPromise(allBoardsAsync)).entries())
        const dnaHash = await getMyDna(ROLE_NAME, appletClient)

        return allBoards
            .filter((r) => !!r)
            .filter((r) => {
                const state = r[1]
                return state.name.toLowerCase().includes(searchFilter.toLowerCase())
            })
            .map((r) => ({ hrl: [dnaHash, r![0]], context: undefined }));
    },
};
