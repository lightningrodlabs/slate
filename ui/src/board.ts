import { cloneDeep, pickBy } from "lodash";
import type { DocumentStore, SessionStore, WorkspaceStore, SynStore } from "@holochain-syn/core";
import { FileStorageClient } from "@holochain-open-dev/file-storage";
import { get, type Readable } from "svelte/store";
import { v1 as uuidv1 } from "uuid";
import { type AgentPubKey, type EntryHash, type EntryHashB64, encodeHashToBase64, type AgentPubKeyB64, type Timestamp } from "@holochain/client";
import { BoardType } from "./boardList";
import type { HrlB64WithContext } from "@lightningrodlabs/we-applet";
import type { AppState, ExcalidrawElement, BinaryFiles } from "@excalidraw/excalidraw/types";
import { dataURItoBlob } from "./util";

export type BoardProps = {
  bgUrl: string,
  attachments: Array<HrlB64WithContext>
}

export type BoardEphemeralState = { [key: string]: string };

export interface BoardState {
  name: string;
  props: BoardProps;
  boundTo: Array<HrlB64WithContext>
  excalidrawElements: ExcalidrawElement[];
  excalidrawAppState: AppState;
  excalidrawFileHashes: { [id: string]: EntryHash[] };
}

export type BoardDelta =
  | {
      type: "set-name";
      name: string;
    }
  | {
      type: "set-state";
      state: BoardState;
    }
  | {
      type: "set-props";
      props: BoardProps;
    }
  | {
      type: "set-excalidraw";
      excalidrawElements: ExcalidrawElement[];
      excalidrawAppState: AppState;
    }
  | {
      type: "set-excalidraw-files";
      fileHashes: { [id: string]: EntryHash[] };
    };;

export const boardGrammar = {
  initialState(init: Partial<BoardState>|undefined = undefined)  {
    const state: BoardState = {
      name: "untitled",
      props: {bgUrl:"", attachments:[]},
      boundTo: [],
      excalidrawElements: [],
      excalidrawAppState: {},
      excalidrawFileHashes: {}
    }
    if (init) {
      Object.assign(state, init);
    }
    return state
  },

  applyDelta(
    delta: BoardDelta,
    state: BoardState,
    _ephemeralState: any,
    _author: AgentPubKey
  ) {
    switch (delta.type) {
      case "set-state":
        if (delta.state.name !== undefined) state.name = delta.state.name
        if (delta.state.props !== undefined) state.props = delta.state.props
        if (delta.state.boundTo !== undefined) state.boundTo = delta.state.boundTo
        break;
      case "set-name":
        state.name = delta.name
        break;
      case "set-props":
        state.props = delta.props
        break;
      case "set-excalidraw":
        // For some reason the customData key is set to undefined which breaks in syn code getValueDescription
        const newExcalidrawElements = cloneDeep(delta.excalidrawElements).map(e => pickBy(e, (v, k) => typeof(v) !== "undefined"))
        state.excalidrawElements = newExcalidrawElements
        // state.excalidrawAppState = delta.excalidrawAppState
        break;
      case "set-excalidraw-files":
        console.log("set-excalidraw-files = ", delta.fileHashes)
        state.excalidrawFileHashes = delta.fileHashes
        break;
    }
  },
};

export type BoardStateData = {
  hash: EntryHash,
  state: BoardState,
}

export class Board {
  public session: SessionStore<BoardState,BoardEphemeralState> | undefined
  public hashB64: EntryHashB64

  constructor(
    public document: DocumentStore<BoardState, BoardEphemeralState>,
    public workspace: WorkspaceStore<BoardState,BoardEphemeralState>,
    public fileStorageClient: FileStorageClient
  ) {
    this.hashB64 = encodeHashToBase64(this.document.documentHash)
    this.fileStorageClient = fileStorageClient
  }

  public static async Create(synStore: SynStore, init: Partial<BoardState>|undefined = undefined) {
    const initState = boardGrammar.initialState(init)

    const documentStore = await synStore.createDocument(initState,{})

    await synStore.client.tagDocument(documentStore.documentHash, BoardType.active)

    const workspaceStore = await documentStore.createWorkspace(
      `${new Date}`,
      undefined
      );

    const fileStorageClient = new FileStorageClient(synStore.client.client, 'griffy');

    const me = new Board(documentStore, workspaceStore, fileStorageClient);
    await me.join()

    if (initState !== undefined) {
      let changes : BoardDelta[] = [{
        type: "set-state",
        state: initState
      }]
      if (changes.length > 0) {
        me.requestChanges(changes)
        await me.session.commitChanges()
      }
    }

    return me
  }

  get hash() : EntryHash {
    return this.document.documentHash
  }

  async join() {
    if (!this.session) this.session = await this.workspace.joinSession()
    console.log("JOINED", this.session)
  }

  async leave() {
    if (this.session) {
      this.session.leaveSession()
      this.session = undefined
      console.log("LEFT SESSION")
    }
  }

  state(): BoardState | undefined {
    if (!this.session) {
      return undefined
    } else {
      return get(this.session.state)
    }
  }

  readableState(): Readable<BoardState> | undefined {
    if (!this.session) {
      return undefined
    } else {
      return this.session.state
    }
  }

  requestChanges(deltas: Array<BoardDelta>) {
    console.log("REQUESTING BOARD CHANGES: ", deltas)
    this.session.change((state,_eph)=>{
      for (const delta of deltas) {
        boardGrammar.applyDelta(delta, state, _eph, undefined)
      }
    })
  }

  async updateFiles(files: BinaryFiles) {
    console.log("updatefiles = ", files, this.fileStorageClient)
    const fileHashes = {}
    for (const fileId in files) {
      const fileData = files[fileId]
      const file = new File([dataURItoBlob(fileData.dataURL)], fileData.id, {
        lastModified: fileData.created,
        type: fileData.mimeType
      });
      const hash = await this.fileStorageClient.uploadFile(file)
      fileHashes[fileData.id] = hash
    }
    console.log("fileHashes = ", fileHashes)
    this.session.change((state, _eph) => {
      boardGrammar.applyDelta({ type: 'set-excalidraw-files', fileHashes }, state, _eph, undefined)
    })
  }

  sessionParticipants() {
    return this.workspace.sessionParticipants
  }

  participants()  {
    if (!this.session) {
      return undefined
    } else {
      return this.session._participants
    }
  }

  async commitChanges() {
    this.session.commitChanges()
  }

}
