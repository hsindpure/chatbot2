define([
    'jquery',
    'qlik',
    'text!./style.css'
], function($, qlik, cssContent) {
    'use strict';

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
                                objectIds: {
                                    ref: "props.objectIds",
                                    label: "QlikSense Object IDs (comma-separated)",
                                    type: "string",
                                    defaultValue: "obj01,obj02"
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
                            resolve({
                                objectId: objectId,
                                data: layout
                            });
                        });
                    }).catch(error => {
                        console.error(`Error fetching object ${objectId}:`, error);
                        resolve({
                            objectId: objectId,
                            error: `Failed to fetch object ${objectId}`
                        });
                    });
                });
            }

            // Get data from specified object IDs
            async function getAllObjectsData() {
                const objectIds = layout.props.objectIds.split(',').map(id => id.trim());
                const objectDataPromises = objectIds.map(objectId => getObjectData(objectId));
                
                try {
                    const results = await Promise.all(objectDataPromises);
                    return results.filter(result => !result.error);
                } catch (error) {
                    console.error('Error fetching objects:', error);
                    return [];
                }
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

                // Loading indicator
                addMessage('Loading...', false);

                try {
                    // Get data from specified QlikSense objects
                    const qlikData = await getAllObjectsData();
                    
                    if (qlikData.length === 0) {
                        $('#chatMessages').children().last().remove(); // Remove loading message
                        addMessage('No data available. Please check the object IDs configuration.');
                        return;
                    }

                    const aiResponse = await sendToAI(userInput, qlikData);
                    
                    // Remove loading message
                    $('#chatMessages').children().last().remove();
                    
                    if (aiResponse.error) {
                        addMessage('Sorry, I encountered an error while processing your request.');
                    } else {
                        addMessage(aiResponse.content);
                    }
                } catch (error) {
                    $('#chatMessages').children().last().remove(); // Remove loading message
                    addMessage('An error occurred while processing your request.');
                    console.error('Error:', error);
                }
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
