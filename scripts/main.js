/**
 * NPC Dialogue Bubbles Module
 * Adds rich, customizable idle speech to NPC tokens via chat bubbles
 */

class NPCDialogueBubbles {
    static MODULE_ID = 'npc-dialogue-bubbles';
    static activeTimers = new Map();
    static isEnabled = true;

    /**
     * Initialize the module
     */
    static init() {
        console.log('NPC Dialogue Bubbles | Initializing module');
        
        // Register module settings
        this.registerSettings();
        
        // Hook into scene ready to start timers
        Hooks.on('ready', this.onReady.bind(this));
        Hooks.on('canvasReady', this.onCanvasReady.bind(this));
        Hooks.on('createToken', this.onCreateToken.bind(this));
        Hooks.on('deleteToken', this.onDeleteToken.bind(this));
        
        // Register context menu after canvas is ready
        Hooks.once('canvasReady', () => {
            this.registerTokenContextMenu();
        });
    }

    /**
     * Register module settings
     */
    static registerSettings() {
        game.settings.register(this.MODULE_ID, 'globalEnabled', {
            name: 'Enable NPC Dialogue',
            hint: 'Enable or disable all NPC dialogue bubbles globally',
            scope: 'world',
            config: true,
            type: Boolean,
            default: true,
            onChange: (value) => {
                this.isEnabled = value;
                if (!value) {
                    this.stopAllTimers();
                } else {
                    this.startAllTimers();
                }
            }
        });

        game.settings.register(this.MODULE_ID, 'debugMode', {
            name: 'Debug Mode',
            hint: 'Enable debug logging for troubleshooting',
            scope: 'world',
            config: true,
            type: Boolean,
            default: false
        });
    }

    /**
     * Add context menu option to tokens
     */
    static registerTokenContextMenu() {
        // Method 1: Token HUD buttons (works reliably)
        Hooks.on('getTokenHUDButtons', (hud, buttons, token) => {
            if (!game.user.isGM) return;
            
            buttons.unshift({
                name: 'dialogue-config',
                icon: 'fas fa-comment',
                condition: true,
                callback: () => this.openDialogueConfig(token.object)
            });
        });

        // Method 2: Direct context menu hook (most reliable for right-click)
        Hooks.on('getTokenContextOptions', (html, contextOptions) => {
            if (!game.user.isGM) return;
            
            contextOptions.push({
                name: "NPCDB.ConfigureDialogue",
                icon: '<i class="fas fa-comment"></i>',
                condition: () => game.user.isGM,
                callback: li => {
                    const tokenId = li.data('token-id') || li.data('tokenId') || li.attr('data-token-id');
                    const token = canvas.tokens.get(tokenId);
                    if (token) {
                        this.openDialogueConfig(token);
                    }
                }
            });
        });

        // Method 3: Alternative approach using core token context
        Hooks.on('renderTokenConfig', (app, html, data) => {
            // Add a button to the token configuration sheet as backup
            const button = $(`<button type="button" style="margin: 5px 0;">
                <i class="fas fa-comment"></i> Configure Dialogue Bubbles
            </button>`);
            
            button.click(() => {
                app.close();
                setTimeout(() => {
                    const token = canvas.tokens.get(data.object._id);
                    if (token) this.openDialogueConfig(token);
                }, 100);
            });
            
            html.find('.sheet-footer').prepend(button);
        });

        console.log('NPC Dialogue Bubbles | Context menu hooks registered');
    }

    /**
     * Open dialogue configuration dialog
     */
    static async openDialogueConfig(token) {
        const dialogueData = token.document.getFlag(this.MODULE_ID, 'dialogue') || {
            phrases: [],
            interval: { min: 10, max: 60 },  // default values
            enabled: true
        };

        const content = `
            <form>
                <div class="form-group">
                    <label>Enable Dialogue for this Token:</label>
                    <input type="checkbox" name="enabled" ${dialogueData.enabled ? 'checked' : ''}>
                </div>
                
                <div class="form-group">
                    <label>Phrases (one per line):</label>
                    <textarea name="phrases" rows="8" style="width: 100%; resize: vertical;">${dialogueData.phrases.join('\n')}</textarea>
                    <p class="notes">Enter each phrase on a new line. Leave blank to disable dialogue.</p>
                </div>
                
                <div class="form-group">
                    <label>Minimum Interval (seconds):</label>
                    <input type="number" name="minInterval" value="${dialogueData.interval.min}" min="5" max="3600">
                </div>
                
                <div class="form-group">
                    <label>Maximum Interval (seconds):</label>
                    <input type="number" name="maxInterval" value="${dialogueData.interval.max}" min="5" max="3600">
                </div>
            </form>
        `;

        new Dialog({
            title: `Configure Dialogue: ${token.document.name}`,
            content: content,
            buttons: {
                save: {
                    label: 'Save',
                    callback: (html) => this.saveDialogueConfig(token, html)
                },
                cancel: {
                    label: 'Cancel'
                }
            },
            default: 'save'
        }, {
            width: 500,
            height: 400
        }).render(true);
    }

    /**
     * Save dialogue configuration
     */
    static async saveDialogueConfig(token, html) {
        const formData = new FormData(html[0].querySelector('form'));
        const phrases = formData.get('phrases').split('\n').filter(p => p.trim());
        const minInterval = parseInt(formData.get('minInterval'));
        const maxInterval = parseInt(formData.get('maxInterval'));
        const enabled = formData.has('enabled');

        // Validate intervals
        if (minInterval >= maxInterval) {
            ui.notifications.warn('Minimum interval must be less than maximum interval');
            return;
        }

        const dialogueData = {
            phrases: phrases,
            interval: { min: minInterval, max: maxInterval },
            enabled: enabled
        };

        await token.document.setFlag(this.MODULE_ID, 'dialogue', dialogueData);
        
        // Restart timer for this token
        this.stopTimer(token.id);
        if (enabled && phrases.length > 0) {
            this.startTimer(token);
        }

        ui.notifications.info(`Dialogue configured for ${token.document.name}`);
        this.debugLog(`Saved dialogue config for token ${token.id}:`, dialogueData);
    }

    /**
     * Start timer for a specific token
     */
    static startTimer(token) {
        if (!this.isEnabled) return;
        
        const dialogueData = token.document.getFlag(this.MODULE_ID, 'dialogue');
        if (!dialogueData || !dialogueData.enabled || !dialogueData.phrases.length) return;

        const delay = this.getRandomInterval(dialogueData.interval.min, dialogueData.interval.max);
        
        const timerId = setTimeout(() => {
            this.speakPhrase(token, dialogueData);
            // Schedule next phrase
            this.startTimer(token);
        }, delay * 1000);

        this.activeTimers.set(token.id, timerId);
        this.debugLog(`Started timer for token ${token.id} with delay ${delay}s`);
    }

    /**
     * Stop timer for a specific token
     */
    static stopTimer(tokenId) {
        if (this.activeTimers.has(tokenId)) {
            clearTimeout(this.activeTimers.get(tokenId));
            this.activeTimers.delete(tokenId);
            this.debugLog(`Stopped timer for token ${tokenId}`);
        }
    }

    /**
     * Make token speak a random phrase
     */
    static speakPhrase(token, dialogueData) {
        if (!token || !dialogueData || !dialogueData.phrases.length) return;
        
        const phrase = dialogueData.phrases[Math.floor(Math.random() * dialogueData.phrases.length)];
        
        // Use Foundry's ChatBubbles API with pan disabled
        if (canvas.hud.bubbles) {
            canvas.hud.bubbles.say(token, phrase, {
                emote: false,
                pan: false  // This prevents the camera from zooming/panning to the token
            });
        }

        this.debugLog(`Token ${token.id} said: "${phrase}"`);
    }

    /**
     * Get random interval between min and max
     */
    static getRandomInterval(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Start all timers for tokens in current scene
     */
    static startAllTimers() {
        if (!canvas.scene || !this.isEnabled) return;

        canvas.tokens.placeables.forEach(token => {
            const dialogueData = token.document.getFlag(this.MODULE_ID, 'dialogue');
            if (dialogueData && dialogueData.enabled && dialogueData.phrases.length > 0) {
                this.startTimer(token);
            }
        });

        this.debugLog('Started all timers for current scene');
    }

    /**
     * Stop all active timers
     */
    static stopAllTimers() {
        this.activeTimers.forEach((timerId, tokenId) => {
            clearTimeout(timerId);
        });
        this.activeTimers.clear();
        this.debugLog('Stopped all timers');
    }

    /**
     * Handle ready hook
     */
    static onReady() {
        this.isEnabled = game.settings.get(this.MODULE_ID, 'globalEnabled');
        
        // Create a global macro for easy access
        this.createGlobalMacro();
        
        console.log('NPC Dialogue Bubbles | Module ready');
    }

    /**
     * Create a global macro for configuring dialogue
     */
    static createGlobalMacro() {
        if (!game.user.isGM) return;

        // Check if macro already exists
        const existingMacro = game.macros.find(m => m.name === "Configure NPC Dialogue");
        if (!existingMacro) {
            Macro.create({
                name: "Configure NPC Dialogue",
                type: "script",
                scope: "global",
                command: `
// NPC Dialogue Bubbles - Quick Configure
const selectedTokens = canvas.tokens.controlled;
if (selectedTokens.length === 0) {
    ui.notifications.warn("Please select a token first!");
    return;
}

if (selectedTokens.length > 1) {
    ui.notifications.warn("Please select only one token!");
    return;
}

const token = selectedTokens[0];
if (window.NPCDialogueBubbles) {
    window.NPCDialogueBubbles.openDialogueConfig(token);
} else {
    ui.notifications.error("NPC Dialogue Bubbles module not loaded!");
}
                `,
                img: "icons/svg/sound.svg",
                folder: null
            }).then(() => {
                console.log('NPC Dialogue Bubbles | Created configuration macro');
            });
        }
    }

    /**
     * Handle canvas ready hook
     */
    static onCanvasReady() {
        this.stopAllTimers();
        this.startAllTimers();
    }

    /**
     * Handle token creation
     */
    static onCreateToken(tokenDocument) {
        const token = tokenDocument.object;
        if (token) {
            setTimeout(() => this.startTimer(token), 1000); // Small delay to ensure token is fully initialized
        }
    }

    /**
     * Handle token deletion
     */
    static onDeleteToken(tokenDocument) {
        this.stopTimer(tokenDocument.id);
    }

    /**
     * Debug logging
     */
    static debugLog(...args) {
        if (game.settings.get(this.MODULE_ID, 'debugMode')) {
            console.log('NPC Dialogue Bubbles |', ...args);
        }
    }
}

// Initialize module when Foundry is ready
Hooks.once('init', () => {
    NPCDialogueBubbles.init();
});

// Global controls for easy access
window.NPCDialogueBubbles = NPCDialogueBubbles;