import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground, TouchableWithoutFeedback, Modal } from 'react-native';
import Matter from 'matter-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';

import Bird from '../../components/game/Bird';
import Floor from '../../components/game/Floor';
import Pipe from '../../components/game/Pipe';
import Coin from '../../components/game/Coin';
import PowerUp from '../../components/game/PowerUp';
import { Physics, getPipeSizePosPair, resetCollisionEvent } from '../../components/game/Physics';
import Constants from '../../components/game/Constants';

const setupWorld = (skin) => {
    resetCollisionEvent();
    let engine = Matter.Engine.create({ enableSleeping: false });
    let world = engine.world;
    world.gravity.y = 0.5;

    const pipeSizePos = getPipeSizePosPair();
    const pipeSizePos2 = getPipeSizePosPair(Constants.MAX_WIDTH * 0.55);

    let bird = Bird(world, 'yellow', { x: Constants.MAX_WIDTH / 3, y: Constants.MAX_HEIGHT / 2 }, { width: Constants.BIRD_WIDTH, height: Constants.BIRD_HEIGHT }, skin);
    let floor = Floor(world, 'green', { x: Constants.MAX_WIDTH / 2, y: Constants.MAX_HEIGHT - 25 }, { width: Constants.MAX_WIDTH, height: 50 });

    let obstacleTop1 = Pipe(world, 'ObstacleTop1', pipeSizePos.pipeTop.pos, pipeSizePos.pipeTop.size, true);
    let obstacleBottom1 = Pipe(world, 'ObstacleBottom1', pipeSizePos.pipeBottom.pos, pipeSizePos.pipeBottom.size, false);

    let obstacleTop2 = Pipe(world, 'ObstacleTop2', pipeSizePos2.pipeTop.pos, pipeSizePos2.pipeTop.size, true);
    let obstacleBottom2 = Pipe(world, 'ObstacleBottom2', pipeSizePos2.pipeBottom.pos, pipeSizePos2.pipeBottom.size, false);

    let coin1 = Coin(world, { x: pipeSizePos.pipeTop.pos.x, y: Constants.MAX_HEIGHT / 2 });
    let coin2 = Coin(world, { x: pipeSizePos2.pipeTop.pos.x, y: Constants.MAX_HEIGHT / 2 });

    let powerUp1 = PowerUp(world, { x: pipeSizePos.pipeTop.pos.x + 400, y: Math.random() * Constants.MAX_HEIGHT }, 'shield');

    return {
        physics: { engine: engine, world: world },
        score: 0, 
        Bird: bird,
        Floor: floor,
        ObstacleTop1: obstacleTop1,
        ObstacleBottom1: obstacleBottom1,
        ObstacleTop2: obstacleTop2,
        ObstacleBottom2: obstacleBottom2,
        Coin1: coin1,
        Coin2: coin2,
        PowerUp1: powerUp1,
    };
};

export default function Index() {
    const [running, setRunning] = useState(false);
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(0);
    const [coins, setCoins] = useState(0);
    const [skin, setSkin] = useState('bird');
    const [shopVisible, setShopVisible] = useState(false);
    const [isNight, setIsNight] = useState(false);
    const [shieldActive, setShieldActive] = useState(false);
    const [gravityInverted, setGravityInverted] = useState(false);

    const [entities, setEntities] = useState(() => setupWorld(skin));
    
    const soundWing = useRef(new Audio.Sound());
    const soundPoint = useRef(new Audio.Sound());
    const soundHit = useRef(new Audio.Sound());
    const soundDie = useRef(new Audio.Sound());

    const entitiesRef = useRef(entities);
    const requestRef = useRef();
    const lastTimeRef = useRef();

    useEffect(() => {
        loadData();
        loadSounds();
        return () => {
            unloadSounds();
        };
    }, []);

    useEffect(() => {
        entitiesRef.current = entities;
    }, [entities]);

    useEffect(() => {
        if (entitiesRef.current && entitiesRef.current.Bird) {
            entitiesRef.current.Bird.hasShield = shieldActive;
            entitiesRef.current.Bird.gravityInverted = gravityInverted;
            
            if (gravityInverted) {
                entitiesRef.current.physics.world.gravity.y = -0.6;
            } else {
                entitiesRef.current.physics.world.gravity.y = 0.5;
            }
        }
    }, [shieldActive, gravityInverted]);

    const loadSounds = async () => {
        try {
            await soundWing.current.loadAsync(require('../../assets/audio/wing.wav'));
            await soundPoint.current.loadAsync(require('../../assets/audio/point.wav'));
            await soundHit.current.loadAsync(require('../../assets/audio/hit.wav'));
            await soundDie.current.loadAsync(require('../../assets/audio/die.wav'));
        } catch (e) {
            console.log(e);
        }
    };

    const unloadSounds = async () => {
        soundWing.current.unloadAsync();
        soundPoint.current.unloadAsync();
        soundHit.current.unloadAsync();
        soundDie.current.unloadAsync();
    };

    const loadData = async () => {
        try {
            const savedScore = await AsyncStorage.getItem('@high_score');
            if (savedScore !== null) setHighScore(parseInt(savedScore, 10));
            
            const savedCoins = await AsyncStorage.getItem('@coins');
            if (savedCoins !== null) setCoins(parseInt(savedCoins, 10));

            const savedSkin = await AsyncStorage.getItem('@skin');
            if (savedSkin !== null) setSkin(savedSkin);
        } catch (e) {
            console.log(e);
        }
    };

    const saveHighScore = async (newScore) => {
        if (newScore > highScore) {
            setHighScore(newScore);
            AsyncStorage.setItem('@high_score', newScore.toString());
        }
    };

    const playSound = async (soundRef) => {
        try { await soundRef.current.replayAsync(); } catch (e) {}
    };

    const dispatch = (e) => {
        if (e.type === 'game_over') {
            setRunning(false);
            setShieldActive(false);
            setGravityInverted(false);
            playSound(soundHit);
            setTimeout(() => playSound(soundDie), 300);
        } else if (e.type === 'new_point') {
            setScore(s => {
                const newScore = s + 1;
                if (Math.floor(newScore / 10) % 2 !== 0) setIsNight(true);
                else setIsNight(false);
                return newScore;
            });
            playSound(soundPoint);
        } else if (e.type === 'add_coin') {
            setCoins(c => {
                const newC = c + 1;
                AsyncStorage.setItem('@coins', newC.toString());
                return newC;
            });
            playSound(soundPoint);
        } else if (e.type === 'activate_powerup') {
            playSound(soundPoint);
            if (e.powerUpType === 'shield') {
                setShieldActive(true);
                setTimeout(() => setShieldActive(false), 5000);
            } else if (e.powerUpType === 'gravity') {
                setGravityInverted(true);
                setTimeout(() => setGravityInverted(false), 5000);
            }
        }
    };

    useEffect(() => {
        if (!running && score > 0) {
            saveHighScore(score);
        }
    }, [running]);

    const loop = time => {
        if (!running) return;
        
        if (lastTimeRef.current != undefined) {
            const delta = time - lastTimeRef.current;
            let currentEntities = entitiesRef.current;
            
            currentEntities = Physics(currentEntities, { 
                touches: [], 
                time: { delta }, 
                dispatch 
            });
            
            setEntities({ ...currentEntities });
        }
        
        lastTimeRef.current = time;
        requestRef.current = requestAnimationFrame(loop);
    };

    useEffect(() => {
        if (running) {
            requestRef.current = requestAnimationFrame(loop);
        } else {
            cancelAnimationFrame(requestRef.current);
            lastTimeRef.current = undefined;
        }
        return () => cancelAnimationFrame(requestRef.current);
    }, [running]);

    const handleTouch = () => {
        if (!running) return;
        playSound(soundWing);
        if (entitiesRef.current && entitiesRef.current.Bird) {
            const jumpVelocity = gravityInverted ? 7 : -7;
            Matter.Body.setVelocity(entitiesRef.current.Bird.body, { x: 0, y: jumpVelocity });
        }
    };

    const restartGame = () => {
        setScore(0);
        setIsNight(false);
        setShieldActive(false);
        setGravityInverted(false);
        setEntities(setupWorld(skin));
        setRunning(true);
    };

    const buySkin = (newSkin, price) => {
        if (coins >= price) {
            setCoins(coins - price);
            AsyncStorage.setItem('@coins', (coins - price).toString());
            setSkin(newSkin);
            AsyncStorage.setItem('@skin', newSkin);
            setEntities(setupWorld(newSkin));
        }
    };

    const selectSkin = (newSkin) => {
        setSkin(newSkin);
        AsyncStorage.setItem('@skin', newSkin);
        setEntities(setupWorld(newSkin));
    };

    return (
        <View style={styles.container}>
            <ImageBackground 
                source={require('../../assets/images/background.png')} 
                style={styles.container}
                resizeMode="cover"
            >
                {/* Gece modu filtresi */}
                {isNight && <View style={styles.nightFilter} />}

                <TouchableWithoutFeedback onPress={handleTouch}>
                    <View style={styles.gameContainer}>
                        {Object.keys(entities).map(key => {
                            const entity = entities[key];
                            if (entity && entity.renderer) {
                                return React.cloneElement(entity.renderer, { 
                                    key: key, 
                                    body: entity.body, 
                                    ...entity 
                                });
                            }
                            return null;
                        })}
                    </View>
                </TouchableWithoutFeedback>

                <View style={styles.scoreContainer} pointerEvents="none">
                    <Text style={styles.scoreText}>{score}</Text>
                </View>

                <View style={styles.coinHUD} pointerEvents="none">
                    <Text style={styles.coinText}>🪙 {coins}</Text>
                </View>

                {shieldActive && <View style={styles.shieldHUD}><Text style={styles.powerText}>🛡️ Kalkan Aktif!</Text></View>}
                {gravityInverted && <View style={styles.gravityHUD}><Text style={styles.powerText}>🔄 Yerçekimi Ters!</Text></View>}

                {!running && !shopVisible && (
                    <View style={styles.fullScreen}>
                        <View style={styles.gameOverPanel}>
                            <Text style={styles.gameOverTitle}>Flappy Bird</Text>
                            
                            <View style={styles.scoreBoard}>
                                <View style={styles.scoreRow}>
                                    <Text style={styles.scoreLabel}>SKOR</Text>
                                    <Text style={styles.scoreValue}>{score}</Text>
                                </View>
                                <View style={styles.scoreRow}>
                                    <Text style={styles.scoreLabel}>EN İYİ</Text>
                                    <Text style={styles.scoreValue}>{highScore}</Text>
                                </View>
                            </View>

                            <TouchableOpacity style={styles.button} onPress={restartGame}>
                                <Text style={styles.buttonText}>OYUNA BAŞLA</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.button, {backgroundColor: '#e6b800', marginTop: 15}]} onPress={() => setShopVisible(true)}>
                                <Text style={styles.buttonText}>🛒 MARKET</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {shopVisible && (
                    <Modal transparent={true} animationType="slide">
                        <View style={styles.fullScreen}>
                            <View style={styles.shopPanel}>
                                <Text style={styles.shopTitle}>KOZMETİK MARKET</Text>
                                <Text style={styles.shopSubtitle}>Altınların: 🪙 {coins}</Text>

                                <TouchableOpacity style={styles.shopItem} onPress={() => selectSkin('bird')}>
                                    <Text style={styles.shopEmoji}>🐦</Text>
                                    <Text style={styles.shopItemText}>Sarı Kuş {skin === 'bird' ? '(Seçili)' : ''}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.shopItem} onPress={() => buySkin('spaceship', 10)}>
                                    <Text style={styles.shopEmoji}>🚀</Text>
                                    <Text style={styles.shopItemText}>Uzay Gemisi (10 🪙) {skin === 'spaceship' ? '(Seçili)' : ''}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.shopItem} onPress={() => buySkin('bat', 25)}>
                                    <Text style={styles.shopEmoji}>🦇</Text>
                                    <Text style={styles.shopItemText}>Yarasa (25 🪙) {skin === 'bat' ? '(Seçili)' : ''}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={[styles.button, {marginTop: 20, backgroundColor: '#d9534f'}]} onPress={() => setShopVisible(false)}>
                                    <Text style={styles.buttonText}>KAPAT</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>
                )}
            </ImageBackground>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    gameContainer: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
    nightFilter: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 50, 0.6)' },
    scoreContainer: { position: 'absolute', top: 80, width: '100%', alignItems: 'center' },
    scoreText: { fontSize: 70, fontWeight: '900', color: 'white', textShadowColor: 'black', textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 3, fontFamily: 'monospace' },
    coinHUD: { position: 'absolute', top: 40, right: 20 },
    coinText: { fontSize: 24, fontWeight: 'bold', color: '#ffcc00', textShadowColor: '#000', textShadowOffset: {width:1, height:1}, textShadowRadius: 2 },
    shieldHUD: { position: 'absolute', top: 100, right: 20, backgroundColor: 'rgba(0,150,255,0.7)', padding: 10, borderRadius: 10 },
    gravityHUD: { position: 'absolute', top: 150, right: 20, backgroundColor: 'rgba(200,0,200,0.7)', padding: 10, borderRadius: 10 },
    powerText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    fullScreen: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
    gameOverPanel: { backgroundColor: '#ded895', padding: 30, borderRadius: 15, alignItems: 'center', borderWidth: 4, borderColor: '#543847', width: '80%', maxWidth: 400 },
    gameOverTitle: { fontSize: 32, fontWeight: 'bold', color: '#f45b27', marginBottom: 20, textShadowColor: 'white', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1 },
    scoreBoard: { backgroundColor: '#eaddc0', width: '100%', borderRadius: 10, padding: 15, marginBottom: 25, borderWidth: 2, borderColor: '#c6b08a' },
    scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 5 },
    scoreLabel: { fontSize: 20, fontWeight: 'bold', color: '#f45b27' },
    scoreValue: { fontSize: 24, fontWeight: 'bold', color: 'white', textShadowColor: 'black', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1 },
    button: { backgroundColor: '#73BF2E', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 10, borderWidth: 3, borderColor: 'white', elevation: 5 },
    buttonText: { color: 'white', fontSize: 24, fontWeight: '900' },
    shopPanel: { backgroundColor: '#2c3e50', padding: 30, borderRadius: 20, alignItems: 'center', width: '85%', borderWidth: 4, borderColor: '#f1c40f' },
    shopTitle: { color: '#f1c40f', fontSize: 28, fontWeight: 'bold', marginBottom: 10 },
    shopSubtitle: { color: 'white', fontSize: 18, marginBottom: 20 },
    shopItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#34495e', width: '100%', padding: 15, borderRadius: 10, marginVertical: 5, borderWidth: 2, borderColor: '#2980b9' },
    shopEmoji: { fontSize: 35, marginRight: 15 },
    shopItemText: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});
