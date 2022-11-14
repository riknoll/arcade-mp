//% color="#207a77"
//% icon="\uf0c0"
//% block=Multiplayer
//% groups='["Controller", "Info", "Other"]'
namespace mp {
    export enum PlayerNumber {
        //% block="1"
        One = 1,
        //% block="2"
        Two = 2,
        //% block="3"
        Three = 3,
        //% block="4"
        Four = 4
    }

    export enum MultiplayerButton {
        //% block="A"
        A,
        //% block="B"
        B,
        //% block="up"
        Up,
        //% block="right"
        Right,
        //% block="down"
        Down,
        //% block="left"
        Left
    }


    let stateStack: MPState[];

    class ButtonHandler {
        constructor(public button: MultiplayerButton, public event: ControllerButtonEvent, public handler: (player: number) => void) {
        }
    }

    class ScoreHandler {
        constructor(public target: number, public handler: (player: number) => void) {
        }
    }

    class PlayerStateEntry {
        public player1: number;
        public player2: number;
        public player3: number;
        public player4: number;

        constructor() {
            this.player1 = 0;
            this.player2 = 0;
            this.player3 = 0;
            this.player4 = 0;
        }

        getForPlayer(player: number) {
            switch (player) {
                case 1: return this.player1;
                case 2: return this.player2;
                case 3: return this.player3;
                case 4: return this.player4;
            }
            return undefined;
        }

        setForPlayer(player: number, value: number) {
            switch (player) {
                case 1: this.player1 = value; break;
                case 2: this.player2 = value; break;
                case 3: this.player3 = value; break;
                case 4: this.player4 = value; break;
            }
        }
    }

    class MPState {
        playerSprites: Sprite[];
        buttonHandlers: ButtonHandler[];
        scoreHandlers: ScoreHandler[];
        playerState: PlayerStateEntry[];
        lifeZeroHandler: (player: number) => void;
        indicatorsVisible: boolean;
        indicatorRenderable: scene.Renderable;

        constructor() {
            this.playerSprites = [];
            this.buttonHandlers = [];
            this.playerState = [];
            this.scoreHandlers = [];
            this.indicatorsVisible = false;
        }

        onButtonEvent(button: MultiplayerButton, event: ControllerButtonEvent, handler: (playerNumber: number) => void) {
            const existing = this.getButtonHandler(button, event);

            if (existing) {
                existing.handler = handler;
                return;
            }

            this.buttonHandlers.push(new ButtonHandler(button, event, handler));

            const registerHandler = (p: number) => {
                getButton(getController(p), button).onEvent(event, () => {
                    this.getButtonHandler(button, event).handler(p);
                });
            }

            for (let player = 1; player < 5; player++) {
                registerHandler(player)
            }
        }

        onReachedScore(score: number, handler: (playerNumber: number) => void) {
            const existing = this.getScoreHandler(score);

            if (existing) {
                existing.handler = handler;
                return;
            }

            this.scoreHandlers.push(new ScoreHandler(score, handler));

            const registerHandler = (p: number) => {
                getInfo(p).onScore(score, () => {
                    this.getScoreHandler(score).handler(p);
                });
            }

            for (let player = 1; player < 5; player++) {
                registerHandler(player);
            }
        }

        onLifeZero(handler: (playerNumber: number) => void) {
            if (!this.lifeZeroHandler) {
                const registerHandler = (p: number) => {
                    getInfo(p).onLifeZero(() => {
                        this.lifeZeroHandler(p);
                    });
                }

                for (let player = 1; player < 5; player++) {
                    registerHandler(player);
                }
            }

            this.lifeZeroHandler = handler;
        }

        setPlayerSprite(player: number, sprite: Sprite) {
            player |= 0;
            if (player < 1 || player > 4) return;
            
            while (this.playerSprites.length < player + 1) {
                this.playerSprites.push(undefined);
            }

            this.playerSprites[player] = sprite;
        }

        getPlayerSprite(player: number) {
            return this.playerSprites[player];
        }

        setPlayerState(player: number, state: number, value: number) {
            this.getOrCreatePlayerStateEntry(state).setForPlayer(player, value);
        }

        getPlayerState(player: number, state: number) {
            return this.getOrCreatePlayerStateEntry(state).getForPlayer(player);
        }

        setPlayerIndicatorsVisible(visible: boolean) {
            this.indicatorsVisible = visible;

            if (visible && !this.indicatorRenderable) {
                this.indicatorRenderable = scene.createRenderable(99, (target, camera) => {
                    if (this.indicatorsVisible) this.drawIndicators(target, camera);
                })
            }
        }

        protected getOrCreatePlayerStateEntry(state: number) {
            if (!this.playerState[state]) {
                while (this.playerState.length < state + 1) {
                    this.playerState.push(undefined);
                }

                this.playerState[state] = new PlayerStateEntry();
            }

            return this.playerState[state];
        }

        protected getButtonHandler(button: MultiplayerButton, event: ControllerButtonEvent) {
            for (const bHandler of this.buttonHandlers) {
                if (bHandler.button === button && bHandler.event === event) return bHandler;
            }

            return undefined;
        }

        protected getScoreHandler(score: number) {
            for (const sHandler of this.scoreHandlers) {
                if (sHandler.target === score) return sHandler;
            }
            return undefined;
        }

        protected drawIndicators(target: Image, camera: scene.Camera) {
            for (let player = 1; player < 5; player++) {
                const sprite = this.getPlayerSprite(player);

                if (!sprite || sprite.flags & (sprites.Flag.Destroyed | sprites.Flag.Invisible)) {
                    continue;
                }

                let top = Fx.toInt(sprite._hitbox.top)
                let bottom = Fx.toInt(sprite._hitbox.bottom)
                let left = Fx.toInt(sprite._hitbox.left)
                let right = Fx.toInt(sprite._hitbox.right)

                if (!(sprite.flags & sprites.Flag.RelativeToCamera)) {
                    top -= camera.drawOffsetY;
                    bottom -= camera.drawOffsetY;
                    left -= camera.drawOffsetX;
                    right -= camera.drawOffsetX;
                }

                if (left < 0) {
                    const indicator = _indicatorForPlayer(player, CollisionDirection.Right);
                    target.drawTransparentImage(
                        indicator,
                        Math.max(right + 2, 0),
                        Math.min(
                            Math.max(
                                (top + ((bottom - top) >> 1) - (indicator.height >> 1)),
                                0
                            ),
                            screen.height - indicator.height
                        )
                    )
                }
                else if (right > 160) {
                    const indicator = _indicatorForPlayer(player, CollisionDirection.Left);
                    target.drawTransparentImage(
                        indicator,
                        Math.min(left - indicator.width - 2, screen.width - indicator.width),
                        Math.min(
                            Math.max(
                                (top + ((bottom - top) >> 1) - (indicator.height >> 1)),
                                0
                            ),
                            screen.height - indicator.height
                        )
                    )
                }
                else if (top < 18) {
                    const indicator = _indicatorForPlayer(player, CollisionDirection.Bottom);
                    target.drawTransparentImage(
                        indicator,
                        (left + ((right - left) >> 1) - (indicator.width >> 1)),
                        Math.max(bottom + 2, 0)
                    )
                }
                else {
                    const indicator = _indicatorForPlayer(player, CollisionDirection.Top);
                    target.drawTransparentImage(
                        indicator,
                        (left + ((right - left) >> 1) - (indicator.width >> 1)),
                        Math.min(top - indicator.height - 2, screen.height - indicator.height)
                    )
                }
            }
        }
    }

    function init() {
        if (stateStack) return;
        stateStack = [new MPState()];
        game.addScenePushHandler(() => {
            stateStack.push(new MPState());
        });

        game.addScenePopHandler(() => {
            stateStack.pop();
            if (stateStack.length === 0) stateStack.push(new MPState());
        });
    }

    export function _state() {
        init();
        return stateStack[stateStack.length - 1];
    }

    //% blockId=mp_moveWithButtons
    //% block="$player control $sprite with buttons||vx $vx vy $vy"
    //% player.shadow=mp_playernumber
    //% sprite.shadow=spritescreate
    //% vx.defl=100
    //% vy.defl=100
    //% vx.shadow="spriteSpeedPicker"
    //% vy.shadow="spriteSpeedPicker"
    //% expandableArgumentMode="toggle"
    //% inlineInputMode=inline
    //% group=Controller
    //% weight=100
    export function moveWithButtons(player: number, sprite: Sprite, vx?: number, vy?: number) {
        getController(player).moveSprite(sprite, vx, vy);
        _state().setPlayerSprite(player, sprite);
    }

    //% blockId=mp_onButtonEvent
    //% block="on $button button $event for $player"
    //% draggableParameters=reporter
    //% group=Controller
    //% weight=90
    export function onButtonEvent(button: MultiplayerButton, event: ControllerButtonEvent, handler: (player: number) => void) {
        _state().onButtonEvent(button, event, handler);
    }

    //% blockId=mp_isButtonPressed
    //% block="is $player $button button pressed"
    //% player.shadow=mp_playernumber
    //% group=Controller
    //% weight=80
    //% blockGap=8
    export function isButtonPressed(player: number, button: MultiplayerButton): boolean {
        return getButton(getController(player), button).isPressed();
    }

    //% blockId=mp_getPlayerSprite
    //% block="sprite controlled by $player"
    //% player.shadow=mp_playernumber
    //% group=Controller
    //% weight=70
    //% blockGap=8
    export function getPlayerSprite(player: number): Sprite {
        return _state().getPlayerSprite(player);
    }

    //% blockId=mp_isPlayerSprite
    //% block="is $sprite controlled by $player"
    //% sprite.shadow=variables_get
    //% sprite.defl=mySprite
    //% player.shadow=mp_playernumber
    //% group=Controller
    //% weight=60
    export function isPlayerSprite(sprite: Sprite, player: number): boolean {
        return getPlayerSprite(player) === sprite;
    }

    //% blockId=mp_getPlayerState
    //% block="$player $state"
    //% player.shadow=mp_playernumber
    //% state.shadow=mp_multiplayerstate
    //% group=Info
    //% weight=100
    //% blockGap=8
    export function getPlayerState(player: number, state: number): number {
        if (state === MultiplayerState.Score) {
            return getInfo(player).score();
        }
        else if (state === MultiplayerState.Lives) {
            return getInfo(player).life();
        }

        return _state().getPlayerState(player, state);
    }

    //% blockId=mp_setPlayerState
    //% block="set $player $state to $value"
    //% player.shadow=mp_playernumber
    //% state.shadow=mp_multiplayerstate
    //% group=Info
    //% weight=90
    //% blockGap=8
    export function setPlayerState(player: number, state: number, value: number) {
        if (state === MultiplayerState.Score) {
            return getInfo(player).setScore(value);
        }
        else if (state === MultiplayerState.Lives) {
            return getInfo(player).setLife(value);
        }

        _state().setPlayerState(player, state, value);
    }

    //% blockId=mp_changePlayerStateBy
    //% block="change $player $state by $deltaValue"
    //% player.shadow=mp_playernumber
    //% state.shadow=mp_multiplayerstate
    //% deltaValue.defl=1
    //% group=Info
    //% weight=80
    export function changePlayerStateBy(player: number, state: number, deltaValue: number) {
        setPlayerState(player, state, getPlayerState(player, state) + deltaValue);
    }

    //% blockId=mp_onScore
    //% block="on score $score for $player"
    //% score.defl=100
    //% draggableParameters=reporter
    //% group=Info
    //% weight=70
    //% blockGap=8
    export function onScore(score: number, handler: (player: number) => void) {
        _state().onReachedScore(score, handler);
    }

    //% blockId=mp_onLifeZero
    //% block="on life zero for $player"
    //% draggableParameters=reporter
    //% group=Info
    //% weight=60
    export function onLifeZero(handler: (player: number) => void) {
        _state().onLifeZero(handler);
    }

    //% blockId=mp_setPlayerIndicatorsVisible
    //% block="set player indicators $visible"
    //% visible.shadow=toggleOnOff
    //% visible.defl=true
    //% group=Other
    //% weight=100
    export function setPlayerIndicatorsVisible(visible: boolean) {
        _state().setPlayerIndicatorsVisible(visible);
    }

    //% blockId=mp_isPlayer
    //% block="$toCheck is $player"
    //% toCheck.shadow=variables_get
    //% toCheck.defl=player
    //% player.shadow=mp_playernumber
    //% group=Other
    //% weight=90
    export function isPlayer(toCheck: number, player: number): boolean {
        return toCheck === player;
    }

    //% blockId=mp_allPlayers
    //% block="array of all players"
    //% group=Other
    //% weight=80
    export function allPlayers(): number[] {
        return [1, 2, 3, 4];
    }

    function getController(player: number) {
        switch (player) {
            case 1: return controller.player1;
            case 2: return controller.player2;
            case 3: return controller.player3;
            case 4: return controller.player4;
        }
        return undefined;
    }

    function getInfo(player: number) {
        switch (player) {
            case 1: return info.player1;
            case 2: return info.player2;
            case 3: return info.player3;
            case 4: return info.player4;
        }
        return undefined;
    }

    function getButton(ctrl: controller.Controller, button: MultiplayerButton) {
        switch (button) {
            case MultiplayerButton.A: return ctrl.A;
            case MultiplayerButton.B: return ctrl.B;
            case MultiplayerButton.Up: return ctrl.up;
            case MultiplayerButton.Right: return ctrl.right;
            case MultiplayerButton.Down: return ctrl.down;
            case MultiplayerButton.Left: return ctrl.left;
        }
    }
}