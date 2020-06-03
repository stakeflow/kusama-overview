<template>
  <div class="container">
    <p v-if="appState.isSyncing === true" class="outOfSyncMessage"><i class="fas fa-exclamation-circle"></i> Kusama node is out of sync</p>
    <div v-else>
      <UserAddresses />
      <NetworkData />
      <div class="section candidatesOverview">
        <NodesList />
      </div>
      <SyncStatus />
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex';
import UserAddresses from '../components/UserAddresses.vue';
import NetworkData from '../components/NetworkData.vue';
import NodesList from '../components/NodesList.vue';
import SyncStatus from '../components/SyncStatus.vue';

export default {

  metaInfo: {
    title: 'Kusama Overview',
    htmlAttrs: {
      lang: 'en',
      amp: true
    }
  },

  components: {
    NetworkData,
    UserAddresses,
    NodesList,
    SyncStatus
  },

  computed: {
    ...mapGetters({
      appState: 'app/appState'
    })
  },

  mounted() {
    this.$store.dispatch('app/getAppStateLoop');
    this.$store.dispatch('user/initAddresses');
    this.$store.dispatch('user/getUserStakesLoop');
    this.$store.dispatch('nodes/getNodesLoop');
  }

};
</script>
