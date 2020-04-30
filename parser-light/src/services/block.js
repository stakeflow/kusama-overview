const { nodeConnection } = require('../nodeConnection');

class BlockService {

    async getBlockData(height) {

        // Get node ws connection
        const api = await nodeConnection.getInstance(process.env.WSNODE);
        
        let hash = await api.rpc.chain.getBlockHash(height).then(result => { return result.toString() });
        let block = await api.rpc.chain.getBlock(hash);
        let extrinsics = block.block.extrinsics;
        
        // Temporary fix for events issue in polkadot-js
        let events = [];
        try {
            events = await api.query.system.events.at(hash);
        } catch (e) {
            console.log(`events error: ${e}`);
        }

        let timestamp = await api.query.timestamp.now.at(hash).then(result => { return result.toString() });
        let era = await api.query.staking.currentEra.at(hash).then(result => { return result.toString() });
        let session = await api.query.session.currentIndex.at(hash).then(result => { return result.toString() });

        return {
            hash: hash,
            timestamp: timestamp,
            era: era,
            session: session,
            extrinsics: extrinsics,
            events: events
        }

    }

    async processBlockData(height, hash, timestamp, era, session, extrinsics, events, runtime) {

        for (let i = 0; i < extrinsics.length; i++) {

            let extrinsic = extrinsics[i].method.toJSON();

            runtime.modules.forEach(module => {
                module.calls.forEach(call => {
                    if (`0x${call.callIndex}` === extrinsic.callIndex ) {
                        switch (`${module.name.toLowerCase()}.${call.name.toLowerCase()}`) {

                            case 'staking.bond':
                                // TODO: bond extrinsic processing
                                break;

                            case 'staking.unbond':
                                // TODO: unbond extrinsic processing
                                break;

                            case '':
                                // TODO: process other extrinsics
                                break;

                        }
                    }
                });
            });

        }

        return true;

    }

}

exports.blockService = new BlockService();
