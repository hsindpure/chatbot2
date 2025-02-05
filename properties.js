define([], function() {
    return {
        type: "items",
        component: "accordion",
        items: {
            settings: {
                uses: "settings",
                items: {
                    aiConfig: {
                        type: "items",
                        label: "AI Configuration",
                        items: {
                            apiEndpoint: {
                                ref: "props.aiEndpoint",
                                label: "AI API Endpoint",
                                type: "string",
                                defaultValue: "http://your-company-ai-endpoint/api"
                            },
                            apiKey: {
                                ref: "props.apiKey",
                                label: "API Key",
                                type: "string",
                                defaultValue: ""
                            }
                        }
                    },
                    voiceSettings: {
                        type: "items",
                        label: "Voice Settings",
                        items: {
                            defaultVoice: {
                                ref: "props.defaultVoice",
                                label: "Default Voice",
                                type: "string",
                                defaultValue: "en-US"
                            }
                        }
                    }
                }
            }
        }
    };
});