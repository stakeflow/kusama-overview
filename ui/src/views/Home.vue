<template>
  <div class="container">
    <UserAddresses />
    <NetworkData />
    <div class="section candidatesOverview">
      <NodesList />
    </div>
    <SyncStatus />
  </div>
</template>

<script>
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

  mounted() {
    this.$store.dispatch('app/getAppStateLoop');
    this.$store.dispatch('user/initAddresses');
    this.$store.dispatch('user/getUserStakesLoop');
    this.$store.dispatch('app/getSyncStatusLoop');
    this.$store.dispatch('nodes/getNodesLoop');
  }

};
</script>
