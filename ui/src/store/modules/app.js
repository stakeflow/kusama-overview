export default {
  namespaced: true,
  state: {
    appVersion: process.env.VUE_APP_VERSION,
    appState: {},
    appHeight: 0,
    networkHeight: 1
  },
  getters: {
    appVersion: (state) => state.appVersion,
    appState: (state) => state.appState,
    appHeight: (state) => state.appHeight,
    networkHeight: (state) => state.networkHeight
  },
  mutations: {
    SET_APP_STATE(state, appState) {
      state.appState = appState;
    },

    SET_APP_HEIGHT(state, appHeight) {
      state.appHeight = appHeight;
    },

    SET_NETWORK_HEIGHT(state, networkHeight) {
      state.networkHeight = networkHeight;
    }
  },
  actions: {
    async getAppState({ commit }) {
      const response = await this._vm.$api.post(
        '/',
        {
          jsonrpc: '2.0',
          method: 'getAppState',
          id: 1
        }
      );

      commit('SET_APP_STATE', response.data.result);
    },

    async getAppStateLoop({ dispatch }) {
      setInterval(() => {
        dispatch('getAppState');
      }, 3000);
    },

    async getSyncStatus({ commit }) {
      commit('SET_APP_HEIGHT', 0);
      commit('SET_NETWORK_HEIGHT', 1);
    },

    async getSyncStatusLoop({ dispatch }) {
      setInterval(() => {
        dispatch('getSyncStatus');
      }, 1000);
    }
  }
};
