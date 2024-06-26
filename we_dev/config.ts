import { defineConfig } from '@lightningrodlabs/we-dev-cli';

export default defineConfig({
  groups: [
    {
      name: 'Lightning Rod Labs',
      networkSeed: '098rc1m-09384u-crm-29384u-cmkj',
      icon: {
        type: 'filesystem',
        path: './we_dev/lrl-icon.png',
      },
      creatingAgent: {
        agentIdx: 1,
        agentProfile: {
          nickname: 'Zippy',
          avatar: {
            type: 'filesystem',
            path: './we_dev/zippy.jpg',
          },
        },
      },
      joiningAgents: [
        {
          agentIdx: 2,
          agentProfile: {
            nickname: 'Zerbina',
            avatar: {
              type: 'filesystem',
              path: './we_dev/zerbina.jpg',
            },
          },
        },
      ],
      applets: [
        {
          name: 'Slate Hot Reload',
          instanceName: 'Slate Hot Reload',
          registeringAgent: 1,
          joiningAgents: [2],
        },
        {
          name: 'kando',
          instanceName: 'kando',
          registeringAgent: 1,
          joiningAgents: [2],
        },
        {
          name: 'notebooks',
          instanceName: 'notebooks',
          registeringAgent: 1,
          joiningAgents: [2],
        },
      ],
    },
  ],
  applets: [
    {
      name: 'Slate Hot Reload',
      subtitle: 'Drawing',
      description: 'draw_it it!',
      icon: {
        type: 'filesystem',
        path: './we_dev/icon.svg',
      },
      source: {
        type: 'localhost',
        happPath: './workdir/slate.happ',
        uiPort: 8888,
      },
    },
    {
        name: 'kando',
        subtitle: 'kanban boards',
        description: 'Real-time kanban boards based on syn',
        icon: {
          type: "https",
          url: "https://raw.githubusercontent.com/holochain-apps/kando/main/we_dev/kando_icon.png"
        },
        source: {
          type: "https",
          url: "https://github.com/holochain-apps/kando/releases/download/v0.9.8/kando.webhapp"
        },
      },
      {
      name: 'notebooks',
      subtitle: 'Collaborative note taking',
      description: 'Real-time notetaking based on syn',
      icon: {
        type: 'https',
        url: 'https://lightningrodlabs.org/projects/notebooks_logo.svg',
      },
      source: {
        type: 'https',
        url: 'https://github.com/lightningrodlabs/notebooks/releases/download/v0.2.10/notebooks.webhapp',
      },
    },
  ],
});