<template>
  <div class="syncStatus" :class="{ visible: (networkHeight - appHeight) > 10 }">
    <div class="syncProgressOuter mainSyncProgress" v-if="(networkHeight - appHeight) > 10">
      <p class="blocksCounter">
        <span>Synchronization status: {{ appHeight }} / {{ networkHeight }} ({{ syncPercent }}%)
        </span>
      </p>
      <div class="syncProgressInner" :style="'width: ' + (appHeight / networkHeight * 100) + '%'"></div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex';

export default {

  computed: {
    ...mapGetters({
      appHeight: 'app/appHeight',
      networkHeight: 'app/networkHeight'
    }),

    syncPercent: () => this.$h.formatNumber((this.appHeight / this.networkHeight) * 100, 2)
  }

};
</script>
