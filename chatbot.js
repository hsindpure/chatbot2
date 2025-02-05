define([
    'jquery',
    'qlik',
    'text!./style.css'
], function($, qlik, cssContent) {
    'use strict';

    // Add CSS to the document
    $("<style>").html(cssContent).appendTo("head");

    return {
        initialProperties: {
            qHyperCubeDef: {
                qDimensions: [],
                qMeasures: [],
                qInitialDataFetch: [{
                    qWidth: 10,
                    qHeight: 50
                }]
            }
        },
        definition: {
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
                                    ref: "props.apiEndpoint",
                                    label: "AI API Endpoint",
                                    type: "string",
                                    defaultValue: "https://your-ai-endpoint.com"
                                },
                                model: {
                                    ref: "props.model",
                                    label: "AI Model Name",
                                    type: "string",
                                    defaultValue: "default-model"
                                },
                                prePrompt: {
                                    ref: "props.prePrompt",
                                    label: "Default Context",
                                    type: "string",
                                    defaultValue: "Analyze the following Qlik data"
                                }
                            }
                        }
                    }
                }
            }
        },
        paint: function($element, layout) {
            const app = qlik.currApp(this);
            
            // Create UI elements
            const container = `
                <div class="ai-chatbot-container">
                    <div class="chat-messages" id="chatMessages"></div>
                    <div class="input-container">
                        <textarea id="userInput" placeholder="Ask a question about your data..."></textarea>
                        <div class="button-container">
                            <button id="sendButton" class="primary-button">Send</button>
                            <button id="speakButton" class="secondary-button">
                                <i class="lui-icon lui-icon--speaker"></i>
                            </button>
                            <button id="copyButton" class="secondary-button">
                                <i class="lui-icon lui-icon--copy"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            $element.html(container);

            // Initialize Text-to-Speech
            const speechSynthesis = window.speechSynthesis;
            let speaking = false;

            // Get QlikSense object data
            async function getObjectData(objectId) {
                return new Promise((resolve, reject) => {
                    app.getObject(objectId).then(function(model) {
                        model.getLayout().then(function(layout) {
                            resolve(layout);
                        });
                    }).catch(reject);
                });
            }

            // Send message to AI
            async function sendToAI(userQuery, qlikData) {
                const payload = {
                    model: layout.props.model,
                    messages: [{
                        role: "user",
                        content: `prepromp:${layout.props.prePrompt} data:${JSON.stringify(qlikData)} query:${userQuery}`
                    }]
                };

                try {
                    const response = await fetch(layout.props.apiEndpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });
                    return await response.json();
                } catch (error) {
                    console.error('Error:', error);
                    return { error: 'Failed to get AI response' };
                }
            }

            // Add message to chat
            function addMessage(message, isUser = false) {
                const messageDiv = $(`
                    <div class="message ${isUser ? 'user-message' : 'ai-message'}">
                        <div class="message-content">${message}</div>
                    </div>
                `);
                $('#chatMessages').append(messageDiv);
                messageDiv[0].scrollIntoView({ behavior: 'smooth' });
            }

            // Handle text-to-speech
            function speak(text) {
                if (speaking) {
                    speechSynthesis.cancel();
                    speaking = false;
                    return;
                }
                
                const utterance = new SpeechSynthesisUtterance(text);
                speaking = true;
                utterance.onend = () => { speaking = false; };
                speechSynthesis.speak(utterance);
            }

            // Event Handlers
            $('#sendButton').click(async function() {
                const userInput = $('#userInput').val().trim();
                if (!userInput) return;

                addMessage(userInput, true);
                $('#userInput').val('');

                // Get data from all visible charts
                const visibleObjects = app.getList('CurrentSelections');
                const qlikData = await Promise.all(
                    visibleObjects.map(obj => getObjectData(obj.objectId))
                );

                const aiResponse = await sendToAI(userInput, qlikData);
                addMessage(aiResponse.content);
            });

            $('#speakButton').click(function() {
                const lastMessage = $('.ai-message').last().text();
                speak(lastMessage);
            });

            $('#copyButton').click(function() {
                const lastMessage = $('.ai-message').last().text();
                navigator.clipboard.writeText(lastMessage);
            });

            return qlik.Promise.resolve();
        }
    };
});
