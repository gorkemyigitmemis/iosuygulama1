import Matter from "matter-js";
import Constants from "./Constants";

let collisionEventAttached = false;

export const Physics = (entities, { touches, time, dispatch }) => {
    let engine = entities.physics.engine;

    // Attach collision event only once
    if (!collisionEventAttached) {
        Matter.Events.on(engine, 'collisionStart', (event) => {
            event.pairs.forEach(pair => {
                const { bodyA, bodyB } = pair;
                const labels = [bodyA.label, bodyB.label];

                if (labels.includes('Bird')) {
                    if (labels.includes('Coin')) {
                        const coinBody = bodyA.label === 'Coin' ? bodyA : bodyB;
                        // Find and deactivate the coin
                        for (let key in entities) {
                            if (entities[key]?.body === coinBody && entities[key].active) {
                                entities[key].active = false;
                                dispatch({ type: 'add_coin' });
                            }
                        }
                    } else if (labels.includes('PowerUp')) {
                        const powerBody = bodyA.label === 'PowerUp' ? bodyA : bodyB;
                        for (let key in entities) {
                            if (entities[key]?.body === powerBody && entities[key].active) {
                                entities[key].active = false;
                                dispatch({ type: 'activate_powerup', powerUpType: powerBody.powerUpType });
                            }
                        }
                    } else if (
                        labels.some(l => l.startsWith('Obstacle') || l.startsWith('Floor'))
                    ) {
                        if (!entities.Bird.hasShield) {
                            dispatch({ type: 'game_over' });
                        } else {
                            // Bounce off slightly if shielded
                            Matter.Body.setVelocity(entities.Bird.body, { x: 0, y: entities.Bird.gravityInverted ? 3 : -3 });
                        }
                    }
                }
            });
        });
        collisionEventAttached = true;
    }

    // Touch logic (inverted gravity support)
    touches.filter(t => t.type === "press").forEach(t => {
        const jumpVelocity = entities.Bird.gravityInverted ? 7 : -7;
        Matter.Body.setVelocity(entities.Bird.body, {
            x: 0,
            y: jumpVelocity
        });
    });

    Matter.Engine.update(engine, time.delta);

    const currentScore = entities.score || 0;
    const speed = Math.max(-8, -3 - (currentScore * 0.15));

    for (let i = 1; i <= 2; i++) {
        // Point scoring
        if (entities[`ObstacleTop${i}`].body.bounds.max.x <= 50 && !entities[`ObstacleTop${i}`].point) {
            entities[`ObstacleTop${i}`].point = true;
            entities.score = (entities.score || 0) + 1;
            dispatch({ type: 'new_point' });
        }

        // Pipe wrapping
        if (entities[`ObstacleTop${i}`].body.bounds.max.x <= 0) {
            const pipeSizePos = getPipeSizePosPair(Constants.MAX_WIDTH * 0.55);
            Matter.Body.setPosition(entities[`ObstacleTop${i}`].body, pipeSizePos.pipeTop.pos);
            Matter.Body.setPosition(entities[`ObstacleBottom${i}`].body, pipeSizePos.pipeBottom.pos);
            entities[`ObstacleTop${i}`].point = false;
        }

        // Move pipes
        Matter.Body.translate(entities[`ObstacleTop${i}`].body, { x: speed, y: 0 });
        Matter.Body.translate(entities[`ObstacleBottom${i}`].body, { x: speed, y: 0 });

        // Move Coins
        if (entities[`Coin${i}`]) {
            let coinBody = entities[`Coin${i}`].body;
            
            if (entities.Bird.hasMagnet && entities[`Coin${i}`].active) {
                const dx = entities.Bird.body.position.x - coinBody.position.x;
                const dy = entities.Bird.body.position.y - coinBody.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < 500) { // Manyetizma menzili
                    Matter.Body.translate(coinBody, { x: dx * 0.08, y: dy * 0.08 });
                } else {
                    Matter.Body.translate(coinBody, { x: speed, y: 0 });
                }
            } else {
                Matter.Body.translate(coinBody, { x: speed, y: 0 });
            }

            if (coinBody.bounds.max.x <= 0) {
                const gapCenterY = entities[`ObstacleTop${i}`].body.position.y + (Constants.MAX_HEIGHT / 2) + (Constants.GAP_SIZE / 2);
                Matter.Body.setPosition(coinBody, { 
                    x: entities[`ObstacleBottom${i}`].body.position.x, 
                    y: gapCenterY
                });
                entities[`Coin${i}`].active = true;
            }
        }

        // Move PowerUps
        if (entities[`PowerUp${i}`]) {
            Matter.Body.translate(entities[`PowerUp${i}`].body, { x: speed, y: 0 });
            if (entities[`PowerUp${i}`].body.bounds.max.x <= -1000) { // Spawns rarely
                Matter.Body.setPosition(entities[`PowerUp${i}`].body, { 
                    x: entities[`ObstacleBottom${i}`].body.position.x + 300, 
                    y: (Constants.MAX_HEIGHT / 2) + (Math.random() * 200 - 100) 
                });
                entities[`PowerUp${i}`].active = true;
                const types = ['shield', 'gravity', 'magnet'];
                const newType = types[Math.floor(Math.random() * types.length)];
                entities[`PowerUp${i}`].type = newType;
                entities[`PowerUp${i}`].body.powerUpType = newType;
            }
        }
    }

    return entities;
};

export const getPipeSizePosPair = (addToPosX = 0) => {
    let yPosTop = -Math.random() * 300; 
    const pipeTop = { 
        pos: { x: Constants.MAX_WIDTH + addToPosX, y: yPosTop }, 
        size: { height: Constants.MAX_HEIGHT, width: Constants.PIPE_WIDTH } 
    };
    const pipeBottom = { 
        pos: { x: Constants.MAX_WIDTH + addToPosX, y: yPosTop + Constants.MAX_HEIGHT + Constants.GAP_SIZE }, 
        size: { height: Constants.MAX_HEIGHT, width: Constants.PIPE_WIDTH } 
    };

    return { pipeTop, pipeBottom };
};

export const resetCollisionEvent = () => {
    collisionEventAttached = false;
};
