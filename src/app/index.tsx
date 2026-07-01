import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground, TouchableWithoutFeedback, Modal, Animated, Easing, Dimensions } from 'react-native';
import Matter from 'matter-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

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
    // Spaceship has heavier gravity
    world.gravity.y = skin === 'spaceship' ? 0.8 : 0.5;

    const pipeSizePos = getPipeSizePosPair();
    const pipeSizePos2 = getPipeSizePosPair(Constants.MAX_WIDTH * 0.55);

    let bird = Bird(world, 'yellow', { x: Constants.MAX_WIDTH / 3, y: Constants.MAX_HEIGHT / 2 }, { width: Constants.BIRD_WIDTH, height: Constants.BIRD_HEIGHT }, skin);
    let floor = Floor(world, 'green', { x: Constants.MAX_WIDTH / 2, y: Constants.MAX_HEIGHT - 25 }, { width: Constants.MAX_WIDTH, height: 50 });

    let obstacleTop1 = Pipe(world, 'ObstacleTop1', pipeSizePos.pipeTop.pos, pipeSizePos.pipeTop.size, true);
    let obstacleBottom1 = Pipe(world, 'ObstacleBottom1', pipeSizePos.pipeBottom.pos, pipeSizePos.pipeBottom.size, false);

    let obstacleTop2 = Pipe(world, 'ObstacleTop2', pipeSizePos2.pipeTop.pos, pipeSizePos2.pipeTop.size, true);
    let obstacleBottom2 = Pipe(world, 'ObstacleBottom2', pipeSizePos2.pipeBottom.pos, pipeSizePos2.pipeBottom.size, false);

    let coin1 = Coin(world, { x: pipeSizePos.pipeTop.pos.x, y: pipeSizePos.pipeTop.pos.y + (Constants.MAX_HEIGHT / 2) + (Constants.GAP_SIZE / 2) });
    let coin2 = Coin(world, { x: pipeSizePos2.pipeTop.pos.x, y: pipeSizePos2.pipeTop.pos.y + (Constants.MAX_HEIGHT / 2) + (Constants.GAP_SIZE / 2) });

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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CoinRain = ({ onComplete }) => {
    const coins = useRef([...Array(40)].map(() => ({
        x: Math.random() * SCREEN_WIDTH,
        animY: new Animated.Value(-50),
        size: Math.random() * 20 + 20, // 20 to 40
        delay: Math.random() * 800,
        duration: Math.random() * 1000 + 1500 // 1.5s to 2.5s
    }))).current;

    useEffect(() => {
        const animations = coins.map(coin => 
            Animated.sequence([
                Animated.delay(coin.delay),
                Animated.timing(coin.animY, {
                    toValue: SCREEN_HEIGHT + 100,
                    duration: coin.duration,
                    easing: Easing.linear,
                    useNativeDriver: true
                })
            ])
        );

        Animated.parallel(animations).start(() => {
            if (onComplete) onComplete();
        });
    }, []);

    return (
        <View style={[StyleSheet.absoluteFill, { zIndex: 999 }]} pointerEvents="none">
            {coins.map((coin, index) => (
                <Animated.Text key={index} style={{
                    position: 'absolute',
                    left: coin.x,
                    fontSize: coin.size,
                    transform: [{ translateY: coin.animY }],
                    textShadowColor: 'black',
                    textShadowOffset: { width: 1, height: 1 },
                    textShadowRadius: 1
                }}>
                    🪙
                </Animated.Text>
            ))}
        </View>
    );
};

const initialMissions = [
    { id: 1, type: 'play', title: 'Oyun Oyna', target: 5, progress: 0, reward: 20, completed: false },
    { id: 2, type: 'coins', title: 'Altın Topla', target: 20, progress: 0, reward: 50, completed: false },
    { id: 3, type: 'score', title: 'Skor Yap', target: 15, progress: 0, reward: 100, completed: false },
];

export default function Index() {
    const [running, setRunning] = useState(false);
    const [paused, setPaused] = useState(false);
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(0);
    const [coins, setCoins] = useState(0);
    const [skin, setSkin] = useState('bird');
    
    const [shopVisible, setShopVisible] = useState(false);
    const [missionsVisible, setMissionsVisible] = useState(false);
    const [slotVisible, setSlotVisible] = useState(false);
    const [slotResultText, setSlotResultText] = useState('Şansını Dene!');
    
    const [reels, setReels] = useState(['🎰', '🎰', '🎰']);
    const [isSpinning, setIsSpinning] = useState(false);
    const [showRain, setShowRain] = useState(false);

    const [isNight, setIsNight] = useState(false);
    const [shieldActive, setShieldActive] = useState(false);
    const [gravityInverted, setGravityInverted] = useState(false);
    const [magnetActive, setMagnetActive] = useState(false);

    const [missions, setMissions] = useState(initialMissions);
    const [entities, setEntities] = useState(() => setupWorld(skin));
    
    const soundWing = useRef(new Audio.Sound());
    const soundPoint = useRef(new Audio.Sound());
    const soundHit = useRef(new Audio.Sound());
    const soundDie = useRef(new Audio.Sound());

    const entitiesRef = useRef(entities);
    const requestRef = useRef();
    const lastTimeRef = useRef();
    const runningRef = useRef(running);
    const pausedRef = useRef(paused);
    
    const skinRef = useRef(skin);
    const isNightRef = useRef(isNight);

    useEffect(() => { runningRef.current = running; }, [running]);
    useEffect(() => { pausedRef.current = paused; }, [paused]);
    useEffect(() => { skinRef.current = skin; }, [skin]);
    useEffect(() => { isNightRef.current = isNight; }, [isNight]);

    useEffect(() => {
        loadData();
        loadSounds();
        return () => unloadSounds();
    }, []);

    useEffect(() => { entitiesRef.current = entities; }, [entities]);

    useEffect(() => {
        if (entitiesRef.current && entitiesRef.current.Bird) {
            entitiesRef.current.Bird.hasShield = shieldActive;
            entitiesRef.current.Bird.gravityInverted = gravityInverted;
            entitiesRef.current.Bird.hasMagnet = magnetActive;
            
            if (gravityInverted) {
                entitiesRef.current.physics.world.gravity.y = -0.6;
            } else {
                entitiesRef.current.physics.world.gravity.y = skin === 'spaceship' ? 0.8 : 0.5;
            }
        }
    }, [shieldActive, gravityInverted, magnetActive, skin]);

    const loadSounds = async () => {
        try {
            await soundWing.current.loadAsync(require('../../assets/audio/wing.wav'));
            await soundPoint.current.loadAsync(require('../../assets/audio/point.wav'));
            await soundHit.current.loadAsync(require('../../assets/audio/hit.wav'));
            await soundDie.current.loadAsync(require('../../assets/audio/die.wav'));
        } catch (e) { console.log(e); }
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

            const savedMissions = await AsyncStorage.getItem('@missions');
            if (savedMissions !== null) setMissions(JSON.parse(savedMissions));
        } catch (e) { console.log(e); }
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

    const updateMission = (type, amount = 1) => {
        setMissions(prev => {
            const next = prev.map(m => {
                if (m.type === type && !m.completed) {
                    const newProgress = type === 'score' ? Math.max(m.progress, amount) : m.progress + amount;
                    if (newProgress >= m.target) {
                        return { ...m, progress: m.target, completed: true };
                    }
                    return { ...m, progress: newProgress };
                }
                return m;
            });
            AsyncStorage.setItem('@missions', JSON.stringify(next));
            return next;
        });
    };

    const claimReward = (id, reward) => {
        setCoins(c => {
            const newC = c + reward;
            AsyncStorage.setItem('@coins', newC.toString());
            return newC;
        });
        setMissions(prev => {
            const next = prev.map(m => {
                if (m.id === id) {
                    return { ...m, target: Math.floor(m.target * 1.5), reward: Math.floor(m.reward * 1.5), progress: 0, completed: false };
                }
                return m;
            });
            AsyncStorage.setItem('@missions', JSON.stringify(next));
            return next;
        });
        playSound(soundPoint);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    const dispatch = (e) => {
        if (e.type === 'game_over') {
            setRunning(false);
            setShieldActive(false);
            setGravityInverted(false);
            setMagnetActive(false);
            playSound(soundHit);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            setTimeout(() => playSound(soundDie), 300);
            updateMission('play');
        } else if (e.type === 'break_shield') {
            setShieldActive(false);
            playSound(soundHit);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        } else if (e.type === 'new_point') {
            setScore(s => {
                const newScore = s + 1;
                if (Math.floor(newScore / 10) % 2 !== 0) setIsNight(true);
                else setIsNight(false);
                updateMission('score', newScore);
                return newScore;
            });
            playSound(soundPoint);
        } else if (e.type === 'add_coin') {
            setCoins(c => {
                // Bat logic: 2x coins at night
                const amount = (skinRef.current === 'bat' && isNightRef.current) ? 2 : 1;
                const newC = c + amount;
                AsyncStorage.setItem('@coins', newC.toString());
                return newC;
            });
            playSound(soundPoint);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            updateMission('coins');
        } else if (e.type === 'activate_powerup') {
            playSound(soundPoint);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (e.powerUpType === 'shield') {
                setShieldActive(true);
                // No timeout! Shield breaks on impact now.
            } else if (e.powerUpType === 'gravity') {
                setGravityInverted(true);
                setTimeout(() => setGravityInverted(false), 5000);
            } else if (e.powerUpType === 'magnet') {
                setMagnetActive(true);
                setTimeout(() => setMagnetActive(false), 5000);
            }
        }
    };

    useEffect(() => {
        if (!running && score > 0) saveHighScore(score);
    }, [running]);

    const loop = time => {
        if (!runningRef.current) return;
        
        if (lastTimeRef.current != undefined && !pausedRef.current) {
            const delta = time - lastTimeRef.current;
            let currentEntities = entitiesRef.current;
            
            currentEntities = Physics(currentEntities, { touches: [], time: { delta }, dispatch });
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
        if (!running || paused) return;
        playSound(soundWing);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (entitiesRef.current && entitiesRef.current.Bird) {
            const jumpVelocity = gravityInverted ? 7 : -7;
            Matter.Body.setVelocity(entitiesRef.current.Bird.body, { x: 0, y: jumpVelocity });
        }
    };

    const restartGame = () => {
        setScore(0);
        setIsNight(false);
        // Spaceship spawns with shield!
        setShieldActive(skin === 'spaceship');
        setGravityInverted(false);
        setMagnetActive(false);
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
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    const selectSkin = (newSkin) => {
        setSkin(newSkin);
        AsyncStorage.setItem('@skin', newSkin);
        setEntities(setupWorld(newSkin));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    const playSlot = () => {
        if (coins < 5 || isSpinning) {
            if (coins < 5) {
                setSlotResultText("Yetersiz Altın! 🪙");
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
            return;
        }
        
        setIsSpinning(true);
        setShowRain(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        
        setCoins(c => {
            const afterBet = c - 5;
            AsyncStorage.setItem('@coins', afterBet.toString());
            return afterBet;
        });
        
        setSlotResultText("Dönüyor... 🎰");
        
        const isWin = Math.random() > 0.5;
        const symbols = ['🍒', '🍋', '🔔', '💎', '7️⃣'];
        const winSymbol = symbols[Math.floor(Math.random() * symbols.length)];
        
        let loseSymbols = [
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)]
        ];
        
        if (!isWin && loseSymbols[0] === loseSymbols[1] && loseSymbols[1] === loseSymbols[2]) {
            loseSymbols[2] = symbols[(symbols.indexOf(loseSymbols[2]) + 1) % symbols.length];
        }
        
        const finalReels = isWin ? [winSymbol, winSymbol, winSymbol] : loseSymbols;
        
        let spins = 0;
        const interval = setInterval(() => {
            spins++;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            
            setReels(prev => {
                let r0 = spins > 10 ? finalReels[0] : symbols[Math.floor(Math.random() * symbols.length)];
                let r1 = spins > 15 ? finalReels[1] : symbols[Math.floor(Math.random() * symbols.length)];
                let r2 = spins > 20 ? finalReels[2] : symbols[Math.floor(Math.random() * symbols.length)];
                return [r0, r1, r2];
            });
            
            if (spins > 20) {
                clearInterval(interval);
                setIsSpinning(false);
                
                if (isWin) {
                    setCoins(c => {
                        const winAmount = c + 10;
                        AsyncStorage.setItem('@coins', winAmount.toString());
                        return winAmount;
                    });
                    setSlotResultText("KAZANDIN! +10 🪙");
                    setShowRain(true);
                    
                    let ringCount = 0;
                    const ringInterval = setInterval(() => {
                        playSound(soundPoint);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        ringCount++;
                        if (ringCount >= 5) clearInterval(ringInterval);
                    }, 150);
                    
                } else {
                    setSlotResultText("KAYBETTİN! 📉");
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    playSound(soundHit);
                }
            }
        }, 100);
    };

    return (
        <View style={styles.container}>
            <ImageBackground source={require('../../assets/images/background.png')} style={styles.container} resizeMode="cover">
                {isNight && <View style={styles.nightFilter} />}

                <TouchableWithoutFeedback onPress={handleTouch}>
                    <View style={styles.gameContainer}>
                        {Object.keys(entities).map(key => {
                            const entity = entities[key];
                            if (entity && entity.renderer) {
                                return React.cloneElement(entity.renderer, { key, body: entity.body, ...entity });
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
                    {skin === 'bat' && isNight && <Text style={{color: '#2ecc71', fontWeight: 'bold', fontSize: 16, textAlign: 'right'}}>2x AKTİF</Text>}
                </View>

                {running && !paused && (
                    <TouchableOpacity style={styles.pauseButton} onPress={() => setPaused(true)}>
                        <Text style={styles.pauseText}>⏸️</Text>
                    </TouchableOpacity>
                )}

                {shieldActive && <View style={styles.shieldHUD}><Text style={styles.powerText}>🛡️ Kalkan!</Text></View>}
                {gravityInverted && <View style={styles.gravityHUD}><Text style={styles.powerText}>🔄 Ters Yerçekimi!</Text></View>}
                {magnetActive && <View style={styles.magnetHUD}><Text style={styles.powerText}>🧲 Mıknatıs!</Text></View>}

                {paused && (
                    <View style={styles.fullScreen}>
                        <View style={styles.gameOverPanel}>
                            <Text style={styles.gameOverTitle}>MOLA</Text>
                            <TouchableOpacity style={styles.button} onPress={() => setPaused(false)}>
                                <Text style={styles.buttonText}>▶️ DEVAM ET</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {!running && !shopVisible && !missionsVisible && !slotVisible && !paused && (
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

                            <View style={styles.actionRow}>
                                <TouchableOpacity style={[styles.button, styles.thirdButton, {backgroundColor: '#e6b800'}]} onPress={() => setShopVisible(true)}>
                                    <Text style={styles.buttonTextMicro}>🛒 MARKET</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.button, styles.thirdButton, {backgroundColor: '#3498db'}]} onPress={() => setMissionsVisible(true)}>
                                    <Text style={styles.buttonTextMicro}>🏆 GÖREV</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.button, styles.thirdButton, {backgroundColor: '#9b59b6'}]} onPress={() => {setSlotVisible(true); setSlotResultText("Şansını Dene!");}}>
                                    <Text style={styles.buttonTextMicro}>🎰 SLOT</Text>
                                </TouchableOpacity>
                            </View>
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
                                    <View>
                                        <Text style={styles.shopItemText}>Uzay Gemisi (10 🪙) {skin === 'spaceship' ? '(Seçili)' : ''}</Text>
                                        <Text style={{color: '#aaa', fontSize: 12}}>Kalkanla başlar, ama ağırdır.</Text>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.shopItem} onPress={() => buySkin('bat', 25)}>
                                    <Text style={styles.shopEmoji}>🦇</Text>
                                    <View>
                                        <Text style={styles.shopItemText}>Yarasa (25 🪙) {skin === 'bat' ? '(Seçili)' : ''}</Text>
                                        <Text style={{color: '#aaa', fontSize: 12}}>Gece modunda 2x altın verir.</Text>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity style={[styles.button, {marginTop: 20, backgroundColor: '#d9534f'}]} onPress={() => setShopVisible(false)}>
                                    <Text style={styles.buttonText}>KAPAT</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>
                )}

                {missionsVisible && (
                    <Modal transparent={true} animationType="slide">
                        <View style={styles.fullScreen}>
                            <View style={[styles.shopPanel, { borderColor: '#3498db' }]}>
                                <Text style={[styles.shopTitle, { color: '#3498db' }]}>GÖREVLER</Text>
                                <Text style={styles.shopSubtitle}>Tamamla ve ödülü kap!</Text>
                                
                                {missions.map(m => (
                                    <View key={m.id} style={styles.shopItem}>
                                        <View style={{flex: 1}}>
                                            <Text style={styles.shopItemText}>{m.title}</Text>
                                            <Text style={{color: '#ccc', marginTop: 5}}>İlerleme: {m.progress} / {m.target}</Text>
                                        </View>
                                        {m.completed ? (
                                            <TouchableOpacity 
                                                style={[styles.button, {paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#2ecc71'}]}
                                                onPress={() => claimReward(m.id, m.reward)}
                                            >
                                                <Text style={{color: 'white', fontWeight: 'bold'}}>AL</Text>
                                            </TouchableOpacity>
                                        ) : (
                                            <View style={{ alignItems: 'center' }}>
                                                <Text style={{color: '#f1c40f', fontWeight: 'bold', fontSize: 18}}>🪙 {m.reward}</Text>
                                            </View>
                                        )}
                                    </View>
                                ))}

                                <TouchableOpacity style={[styles.button, {marginTop: 20, backgroundColor: '#d9534f'}]} onPress={() => setMissionsVisible(false)}>
                                    <Text style={styles.buttonText}>KAPAT</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>
                )}

                {slotVisible && (
                    <Modal transparent={true} animationType="fade">
                        <View style={styles.fullScreen}>
                            <View style={[styles.shopPanel, { borderColor: '#9b59b6', backgroundColor: '#8e44ad' }]}>
                                <Text style={[styles.shopTitle, { color: 'white' }]}>🎰 SLOT MAKİNESİ</Text>
                                <Text style={styles.shopSubtitle}>Mevcut Altın: 🪙 {coins}</Text>

                                <View style={{ flexDirection: 'row', justifyContent: 'center', marginVertical: 20 }}>
                                    <View style={styles.reelBox}><Text style={styles.reelText}>{reels[0]}</Text></View>
                                    <View style={styles.reelBox}><Text style={styles.reelText}>{reels[1]}</Text></View>
                                    <View style={styles.reelBox}><Text style={styles.reelText}>{reels[2]}</Text></View>
                                </View>

                                <View style={{ backgroundColor: '#2c3e50', padding: 15, borderRadius: 10, borderWidth: 3, borderColor: '#f1c40f', marginBottom: 20, width: '100%', alignItems: 'center' }}>
                                    <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', textAlign: 'center' }}>{slotResultText}</Text>
                                </View>

                                <TouchableOpacity 
                                    style={[styles.button, {backgroundColor: isSpinning ? '#7f8c8d' : '#f1c40f', paddingVertical: 20, width: '100%', alignItems: 'center'}]}
                                    onPress={playSlot}
                                    disabled={isSpinning}
                                >
                                    <Text style={[styles.buttonText, {color: '#2c3e50'}]}>{isSpinning ? 'DÖNÜYOR...' : 'KOLU ÇEK (5 🪙)'}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={[styles.button, {marginTop: 20, backgroundColor: '#d9534f'}]} onPress={() => setSlotVisible(false)} disabled={isSpinning}>
                                    <Text style={styles.buttonText}>KAPAT</Text>
                                </TouchableOpacity>
                            </View>
                            {showRain && <CoinRain />}
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
    pauseButton: { position: 'absolute', top: 40, left: 20, backgroundColor: 'rgba(255,255,255,0.4)', padding: 10, borderRadius: 10 },
    pauseText: { fontSize: 24 },
    shieldHUD: { position: 'absolute', top: 100, right: 20, backgroundColor: 'rgba(0,150,255,0.7)', padding: 10, borderRadius: 10 },
    gravityHUD: { position: 'absolute', top: 150, right: 20, backgroundColor: 'rgba(200,0,200,0.7)', padding: 10, borderRadius: 10 },
    magnetHUD: { position: 'absolute', top: 200, right: 20, backgroundColor: 'rgba(255,100,0,0.7)', padding: 10, borderRadius: 10 },
    powerText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    fullScreen: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
    gameOverPanel: { backgroundColor: '#ded895', padding: 30, borderRadius: 15, alignItems: 'center', borderWidth: 4, borderColor: '#543847', width: '90%', maxWidth: 400 },
    gameOverTitle: { fontSize: 32, fontWeight: 'bold', color: '#f45b27', marginBottom: 20, textShadowColor: 'white', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1 },
    scoreBoard: { backgroundColor: '#eaddc0', width: '100%', borderRadius: 10, padding: 15, marginBottom: 25, borderWidth: 2, borderColor: '#c6b08a' },
    scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 5 },
    scoreLabel: { fontSize: 20, fontWeight: 'bold', color: '#f45b27' },
    scoreValue: { fontSize: 24, fontWeight: 'bold', color: 'white', textShadowColor: 'black', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1 },
    button: { backgroundColor: '#73BF2E', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 10, borderWidth: 3, borderColor: 'white', elevation: 5 },
    actionRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 15 },
    thirdButton: { paddingHorizontal: 5, flex: 1, marginHorizontal: 3, alignItems: 'center' },
    buttonText: { color: 'white', fontSize: 24, fontWeight: '900' },
    buttonTextMicro: { color: 'white', fontSize: 14, fontWeight: '900' },
    shopPanel: { backgroundColor: '#2c3e50', padding: 30, borderRadius: 20, alignItems: 'center', width: '85%', borderWidth: 4, borderColor: '#f1c40f' },
    shopTitle: { color: '#f1c40f', fontSize: 28, fontWeight: 'bold', marginBottom: 10 },
    shopSubtitle: { color: 'white', fontSize: 18, marginBottom: 20 },
    shopItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#34495e', width: '100%', padding: 15, borderRadius: 10, marginVertical: 5, borderWidth: 2, borderColor: '#2980b9' },
    shopEmoji: { fontSize: 35, marginRight: 15 },
    shopItemText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    reelBox: { backgroundColor: 'white', padding: 15, marginHorizontal: 5, borderRadius: 10, borderWidth: 4, borderColor: '#e74c3c', width: 80, height: 80, justifyContent: 'center', alignItems: 'center' },
    reelText: { fontSize: 45 }
});
