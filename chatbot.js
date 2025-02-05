
define([
    "qlik",
    "jquery",
    "./properties",
    "text!./template.html",
    "css!./style.css"
], function(qlik, $, properties, template) {
    'use strict';

    return {
        template: template,
        definition: properties,
        support: {
            snapshot: true,
            export: true,
            exportData: true
        },
        paint: function($element, layout) {
            return qlik.Promise.resolve();
        },
        controller: ['$scope', function($scope) {
            // Initialize variables
            $scope.messages = [];
            $scope.userInput = '';
            $scope.selectedObjects = [];
            $scope.speechEnabled = false;
            
            // Speech synthesis setup
            const speechSynthesis = window.speechSynthesis;
            let speechRecognition = null;
            if (window.webkitSpeechRecognition) {
                speechRecognition = new webkitSpeechRecognition();
                speechRecognition.continuous = false;
                speechRecognition.interimResults = false;
                speechRecognition.lang = 'en-US';
            }

            // Get current app
            const app = qlik.currApp();

            // Initialize AI API
            async function callAI(question, context) {
                try {
                    const response = await fetch($scope.layout.props.aiEndpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${$scope.layout.props.apiKey}`
                        },
                        body: JSON.stringify({
                            question: question,
                            context: context
                        })
                    });

                    return await response.json();
                } catch (error) {
                    console.error('AI API Error:', error);
                    return {
                        error: 'Failed to get response from AI'
                    };
                }
            }

            // Get data from selected objects
            async function getObjectsData() {
                const objectsData = {};
                
                for (const objectId of $scope.selectedObjects) {
                    try {
                        const obj = await app.getObject(objectId);
                        const layout = await obj.getLayout();
                        const data = await obj.getHyperCubeData('/qHyperCubeDef', [{
                            qTop: 0,
                            qLeft: 0,
                            qWidth: 10,
                            qHeight: 100
                        }]);
                        
                        objectsData[objectId] = {
                            type: layout.visualization,
                            title: layout.title,
                            data: data[0].qMatrix,
                            dimensions: layout.qHyperCube.qDimensionInfo,
                            measures: layout.qHyperCube.qMeasureInfo
                        };
                    } catch (error) {
                        console.error(`Error getting data for object ${objectId}:`, error);
                    }
                }
                
                return objectsData;
            }

            // Create visualization based on AI response
            async function createVisualization(vizConfig) {
                try {
                    const chartId = 'chart_' + Date.now();
                    const vis = await app.visualization.create(
                        vizConfig.type,
                        {
                            qHyperCubeDef: {
                                qDimensions: vizConfig.dimensions,
                                qMeasures: vizConfig.measures
                            }
                        },
                        vizConfig.properties
                    );
                    
                    return {
                        chartId: chartId,
                        visualization: vis
                    };
                } catch (error) {
                    console.error('Visualization creation error:', error);
                    return null;
                }
            }

            // Voice input handling
            $scope.toggleVoiceInput = function() {
                if (!speechRecognition) {
                    alert('Speech recognition is not supported in your browser');
                    return;
                }

                speechRecognition.onresult = function(event) {
                    const transcript = event.results[0][0].transcript;
                    $scope.userInput = transcript;
                    $scope.$apply();
                    $scope.sendMessage();
                };

                speechRecognition.start();
            };

            // Text-to-speech handling
            $scope.speakMessage = function(text) {
                if (!speechSynthesis) {
                    alert('Text-to-speech is not supported in your browser');
                    return;
                }

                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = $scope.layout.props.defaultVoice;
                speechSynthesis.speak(utterance);
            };

            // Copy to clipboard
            $scope.copyToClipboard = function(text) {
                navigator.clipboard.writeText(text).then(() => {
                    // Show success notification
                    const notification = document.createElement('div');
                    notification.className = 'copy-notification';
                    notification.textContent = 'Copied to clipboard!';
                    document.body.appendChild(notification);
                    setTimeout(() => notification.remove(), 2000);
                });
            };

            // Send message to AI
            $scope.sendMessage = async function() {
                if (!$scope.userInput.trim()) return;

                const userMessage = $scope.userInput;
                
                // Add user message
                $scope.messages.push({
                    type: 'user',
                    text: userMessage,
                    timestamp: new Date()
                });

                // Clear input
                $scope.userInput = '';

                // Get data context from selected objects
                const context = await getObjectsData();

                // Call AI with context
                const aiResponse = await callAI(userMessage, context);

                if (aiResponse.error) {
                    $scope.messages.push({
                        type: 'bot',
                        text: aiResponse.error,
                        timestamp: new Date()
                    });
                } else {
                    // Handle visualization if requested
                    if (aiResponse.visualization) {
                        const vizResult = await createVisualization(aiResponse.visualization);
                        if (vizResult) {
                            $scope.messages.push({
                                type: 'bot',
                                text: aiResponse.text,
                                chartId: vizResult.chartId,
                                timestamp: new Date()
                            });

                            // Render visualization after DOM update
                            setTimeout(() => {
                                vizResult.visualization.show(vizResult.chartId);
                            }, 100);
                        }
                    } else {
                        $scope.messages.push({
                            type: 'bot',
                            text: aiResponse.text,
                            timestamp: new Date()
                        });
                    }
                }

                // Speak response if enabled
                if ($scope.speechEnabled) {
                    $scope.speakMessage(aiResponse.text);
                }

                $scope.$apply();
            };

            // Handle enter key
            $scope.handleKeyPress = function(event) {
                if (event.which === 13) {
                    $scope.sendMessage();
                }
            };

            // Clear selected objects
            $scope.clearSelectedObjects = function() {
                $scope.selectedObjects = [];
            };

            // Toggle speech
            $scope.toggleSpeech = function() {
                $scope.speechEnabled = !$scope.speechEnabled;
            };

            // Initialize object selection listener
            app.getList('SelectedObjects').then(function(model) {
                model.OnData.bind(function() {
                    $scope.selectedObjects = model.layout.selectedObjects.map(obj => obj.id);
                    $scope.$apply();
                });
            });
        }]
    };
});