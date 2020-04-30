import Vue from 'vue';
import _ from 'lodash';

export default {
  install: () => {
    Vue.prototype.$h = {
      convert: (pip) => _.round(pip / 1000000000000, 12),

      formatNumber: (number, precision = 18) => {
        const result = _.round(number, precision).toString().split('.');
        if (result[0].length >= 4) {
          result[0] = result[0].replace(/(\d)(?=(\d{3})+$)/g, '$1 ');
        }
        return result.join('.');
      },

      minimizeString: (input, chars) => `${input.substring(0, chars)}..${input.substring(input.length - chars)}`,

      getNodeStatusClass(statusCode) {
        switch (Number(statusCode)) {
          case 1:
            return 'fas fa-circle statusActiveValidator';
          case 2:
            return 'fas fa-circle statusCandidate';
          case 3:
            return 'fas fa-stop statusValidatorOff';
          case 4:
            return 'fas fa-times statusOffline';
          default:
            return '';
        }
      },

      getNodeStatusText(statusCode) {
        switch (Number(statusCode)) {
          case 1:
            return 'Validator';
          case 2:
            return 'Candidate';
          case 3:
            return 'Candidate Off';
          case 4:
            return 'Node Offline';
          default:
            return 'Unknown status';
        }
      }
    };
  }
};
