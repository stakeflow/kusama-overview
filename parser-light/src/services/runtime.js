const { nodeConnection } = require('../nodeConnection');

const Runtime = require('../db/models/Runtime');

class RuntimeService {

    async getRuntime(hash) {

        // Get node ws connection
        const api = await nodeConnection.getInstance(process.env.WSNODE);

        // Get runtime version for block
        let specVersion = await api.rpc.state.getRuntimeVersion(hash).then(result => { return result.toJSON().specVersion });

        // Get runtimes data from db
        let runtime = await Runtime.findOne({ version: specVersion }).then(result => { return result });

        // If current node's runtime not in our db yet let's add it
        if (runtime === null) {
            // Get node's runtime metadata
            let metadata = await api.rpc.state.getMetadata(hash).then(result => { return result.toJSON() });

            // Save it in db and return back
            runtime = await this.saveRuntime(specVersion, metadata.metadata);
        }

        // Apply block's metadata to api instance
        //let metadataToInject = await api.rpc.state.getMetadata(hash);
        //api.injectMetadata(metadataToInject);

        return runtime;

    }

    async saveRuntime(specVersion, metadata) {

        // Get node ws connection
        const api = await nodeConnection.getInstance(process.env.WSNODE);

        // Prepare runtime data
        let runtime;
        if ("V9" in metadata) {
            runtime = this.prepareV9Metadata(specVersion, metadata);
        } else if ("V8" in metadata) {
            runtime = this.prepareV8Metadata(specVersion, metadata);
        } else if ("V7" in metadata) {
            runtime = this.prepareV7Metadata(specVersion, metadata);
        } else {
            // Unknown metadata version
            // TODO: throw exception and exit
        }

        // Save new runtime in DB
        runtime = new Runtime(runtime);

        try {
            await runtime.save().then(res => { return res });
        } catch (err){
            console.log(err);
        }

        return runtime;

    }

    prepareV9Metadata(specVersion, metadata) {
        let modules = metadata.V9.modules;

        let runtime = {};
        runtime.modules = [];
        runtime.version = specVersion;

        let callModuleIndex = -1;
        let eventModuleIndex = -1;
        modules.forEach((module) => {
            let calls = [];
            let events = [];

            if (module.calls !== null) {
                callModuleIndex++;

                if (module.calls.length > 0) {
                    calls = module.calls.map((call, i) => {

                        let documentation = '';
                        call.documentation.forEach((documentationItem, i) => {
                            if (i === 0) {
                                documentation += documentationItem.trimLeft();
                            } else if (documentationItem === '') {
                                documentation += '\n\n';
                            } else {
                                if (call.documentation[i - 1] === '') {
                                    documentation += documentationItem.trimLeft();
                                } else {
                                    documentation += documentationItem;
                                }
                            }
                        });
    
                        return {
                            name: call.name,
                            callIndex: this.toHex(callModuleIndex) + this.toHex(i),
                            documentation: documentation,
                            args: call.args
                        }
                    });
                }
            }

            if (module.events !== null) {
                eventModuleIndex++;

                if (module.events.length > 0) {
                    events = module.events.map((event, i) => {

                        let documentation = '';
                        event.documentation.forEach((documentationItem, i) => {
                            if (i === 0) {
                                documentation += documentationItem.trimLeft();
                            } else if (documentationItem === '') {
                                documentation += '\n\n';
                            } else {
                                if (event.documentation[i - 1] === '') {
                                    documentation += documentationItem.trimLeft();
                                } else {
                                    documentation += documentationItem;
                                }
                            }
                        });
    
                        return {
                            name: event.name,
                            eventIndex: this.toHex(eventModuleIndex) + this.toHex(i),
                            documentation: documentation,
                            args: event.args
                        }
                    });
                }
            }

            runtime.modules.push({
                name: module.name,
                calls: calls,
                events: events
            });
        });

        return runtime;
    }

    prepareV8Metadata(specVersion, metadata) {
        let modules = metadata.V8.modules;

        let runtime = {};
        runtime.modules = [];
        runtime.version = specVersion;

        let callModuleIndex = -1;
        let eventModuleIndex = -1;
        modules.forEach((module) => {
            let calls = [];
            let events = [];

            if (module.calls !== null) {
                callModuleIndex++;

                if (module.calls.length > 0) {
                    calls = module.calls.map((call, i) => {

                        let documentation = '';
                        call.documentation.forEach((documentationItem, i) => {
                            if (i === 0) {
                                documentation += documentationItem.trimLeft();
                            } else if (documentationItem === '') {
                                documentation += '\n\n';
                            } else {
                                if (call.documentation[i - 1] === '') {
                                    documentation += documentationItem.trimLeft();
                                } else {
                                    documentation += documentationItem;
                                }
                            }
                        });
    
                        return {
                            name: call.name,
                            callIndex: this.toHex(callModuleIndex) + this.toHex(i),
                            documentation: documentation,
                            args: call.args
                        }
                    });
                }
            }

            if (module.events !== null) {
                eventModuleIndex++;

                if (module.events.length > 0) {
                    events = module.events.map((event, i) => {

                        let documentation = '';
                        event.documentation.forEach((documentationItem, i) => {
                            if (i === 0) {
                                documentation += documentationItem.trimLeft();
                            } else if (documentationItem === '') {
                                documentation += '\n\n';
                            } else {
                                if (event.documentation[i - 1] === '') {
                                    documentation += documentationItem.trimLeft();
                                } else {
                                    documentation += documentationItem;
                                }
                            }
                        });
    
                        return {
                            name: event.name,
                            eventIndex: this.toHex(eventModuleIndex) + this.toHex(i),
                            documentation: documentation,
                            args: event.args
                        }
                    });
                }
            }

            runtime.modules.push({
                name: module.name,
                calls: calls,
                events: events
            });
        });

        return runtime;
    }

    prepareV7Metadata(specVersion, metadata) {
        let modules = metadata.V7.modules;

        let runtime = {};
        runtime.modules = [];
        runtime.version = specVersion;

        let callModuleIndex = -1;
        let eventModuleIndex = -1;
        modules.forEach((module) => {
            let calls = [];
            let events = [];

            if (module.calls !== null) {
                callModuleIndex++;

                if (module.calls.length > 0) {
                    calls = module.calls.map((call, i) => {

                        let documentation = '';
                        call.documentation.forEach((documentationItem, i) => {
                            if (i === 0) {
                                documentation += documentationItem.trimLeft();
                            } else if (documentationItem === '') {
                                documentation += '\n\n';
                            } else {
                                if (call.documentation[i - 1] === '') {
                                    documentation += documentationItem.trimLeft();
                                } else {
                                    documentation += documentationItem;
                                }
                            }
                        });
    
                        return {
                            name: call.name,
                            callIndex: this.toHex(callModuleIndex) + this.toHex(i),
                            documentation: documentation,
                            args: call.args
                        }
                    });
                }
            }

            if (module.events !== null) {
                eventModuleIndex++;

                if (module.events.length > 0) {
                    events = module.events.map((event, i) => {

                        let documentation = '';
                        event.documentation.forEach((documentationItem, i) => {
                            if (i === 0) {
                                documentation += documentationItem.trimLeft();
                            } else if (documentationItem === '') {
                                documentation += '\n\n';
                            } else {
                                if (event.documentation[i - 1] === '') {
                                    documentation += documentationItem.trimLeft();
                                } else {
                                    documentation += documentationItem;
                                }
                            }
                        });
    
                        return {
                            name: event.name,
                            eventIndex: this.toHex(eventModuleIndex) + this.toHex(i),
                            documentation: documentation,
                            args: event.args
                        }
                    });
                }
            }

            runtime.modules.push({
                name: module.name,
                calls: calls,
                events: events
            });
        });

        return runtime;
    }

    toHex (d) {
        return ("0" + (Number(d).toString(16))).slice(-2);
    }

};

exports.runtimeService = new RuntimeService();
