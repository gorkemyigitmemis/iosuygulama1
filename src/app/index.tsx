import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground, TouchableWithoutFeedback, Modal, Animated, Easing, Dimensions } from 'react-native';
import Matter from 'matter-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

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
        size: Math.random() * 20 + 20, 
        delay: Math.random() * 800,
        duration: Math.random() * 1000 + 1500 
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
                    {skin === 'bat' && isNight && <Text style={styles.batMultiplier}>2x AKTİF</Text>}
                </View>

                {running && !paused && (
                    <TouchableOpacity style={styles.pauseButton} onPress={() => setPaused(true)}>
                        <BlurView intensity={30} tint="light" style={styles.glassBadge}>
                            <Text style={styles.pauseText}>⏸️</Text>
                        </BlurView>
                    </TouchableOpacity>
                )}

                {shieldActive && (
                    <View style={styles.shieldHUD}>
                        <BlurView intensity={50} tint="dark" style={styles.glassBadge}>
                            <Text style={styles.powerText}>🛡️ KALKAN</Text>
                        </BlurView>
                    </View>
                )}
                
                {gravityInverted && (
                    <View style={styles.gravityHUD}>
                        <BlurView intensity={50} tint="dark" style={styles.glassBadge}>
                            <Text style={styles.powerText}>🔄 TERS YERÇEKİMİ</Text>
                        </BlurView>
                    </View>
                )}
                
                {magnetActive && (
                    <View style={styles.magnetHUD}>
                        <BlurView intensity={50} tint="dark" style={styles.glassBadge}>
                            <Text style={styles.powerText}>🧲 MIKNATIS</Text>
                        </BlurView>
                    </View>
                )}

                {paused && (
                    <View style={styles.fullScreen}>
                        <BlurView intensity={60} tint="dark" style={styles.gameOverPanel}>
                            <Text style={styles.gameOverTitle}>MOLA</Text>
                            <TouchableOpacity onPress={() => setPaused(false)}>
                                <LinearGradient colors={['#00c6ff', '#0072ff']} style={styles.gradientButton}>
                                    <Text style={styles.buttonText}>▶️ DEVAM ET</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </BlurView>
                    </View>
                )}

                {!running && !shopVisible && !missionsVisible && !slotVisible && !paused && (
                    <View style={styles.fullScreen}>
                        <BlurView intensity={60} tint="dark" style={styles.gameOverPanel}>
                            <Text style={styles.gameOverTitle}>Flappy Bird</Text>
                            
                            <View style={styles.scoreBoardGlass}>
                                <View style={styles.scoreRow}>
                                    <Text style={styles.scoreLabel}>SKOR</Text>
                                    <Text style={styles.scoreValue}>{score}</Text>
                                </View>
                                <View style={styles.scoreRow}>
                                    <Text style={styles.scoreLabel}>EN İYİ</Text>
                                    <Text style={styles.scoreValue}>{highScore}</Text>
                                </View>
                            </View>

                            <TouchableOpacity onPress={restartGame}>
                                <LinearGradient colors={['#f83600', '#f9d423']} style={styles.gradientButton}>
                                    <Text style={styles.buttonText}>🚀 OYUNA BAŞLA</Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            <View style={styles.actionRow}>
                                <TouchableOpacity style={styles.thirdButtonWrapper} onPress={() => setShopVisible(true)}>
                                    <LinearGradient colors={['#f6d365', '#fda085']} style={styles.gradientButtonSmall}>
                                        <Text style={styles.buttonTextMicro}>🛒 MARKET</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.thirdButtonWrapper} onPress={() => setMissionsVisible(true)}>
                                    <LinearGradient colors={['#4facfe', '#00f2fe']} style={styles.gradientButtonSmall}>
                                        <Text style={styles.buttonTextMicro}>🏆 GÖREV</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.thirdButtonWrapper} onPress={() => {setSlotVisible(true); setSlotResultText("Şansını Dene!");}}>
                                    <LinearGradient colors={['#b224ef', '#7579ff']} style={styles.gradientButtonSmall}>
                                        <Text style={styles.buttonTextMicro}>🎰 SLOT</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </BlurView>
                    </View>
                )}

                {shopVisible && (
                    <Modal transparent={true} animationType="slide">
                        <View style={styles.fullScreen}>
                            <BlurView intensity={70} tint="dark" style={styles.shopPanel}>
                                <Text style={styles.shopTitle}>MARKET</Text>
                                <Text style={styles.shopSubtitle}>Mevcut Altın: 🪙 {coins}</Text>

                                <TouchableOpacity style={styles.shopItem} onPress={() => selectSkin('bird')}>
                                    <Text style={styles.shopEmoji}>🐦</Text>
                                    <Text style={styles.shopItemText}>Sarı Kuş {skin === 'bird' ? '(Seçili)' : ''}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.shopItem} onPress={() => buySkin('spaceship', 10)}>
                                    <Text style={styles.shopEmoji}>🚀</Text>
                                    <View>
                                        <Text style={styles.shopItemText}>Uzay Gemisi (10 🪙) {skin === 'spaceship' ? '(Seçili)' : ''}</Text>
                                        <Text style={styles.shopItemDesc}>Kalkanla başlar, ağırdır.</Text>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.shopItem} onPress={() => buySkin('bat', 25)}>
                                    <Text style={styles.shopEmoji}>🦇</Text>
                                    <View>
                                        <Text style={styles.shopItemText}>Yarasa (25 🪙) {skin === 'bat' ? '(Seçili)' : ''}</Text>
                                        <Text style={styles.shopItemDesc}>Gece modunda 2x altın verir.</Text>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity style={{marginTop: 20, width: '100%'}} onPress={() => setShopVisible(false)}>
                                    <LinearGradient colors={['#ff0844', '#ffb199']} style={styles.gradientButton}>
                                        <Text style={styles.buttonText}>KAPAT</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </BlurView>
                        </View>
                    </Modal>
                )}

                {missionsVisible && (
                    <Modal transparent={true} animationType="slide">
                        <View style={styles.fullScreen}>
                            <BlurView intensity={70} tint="dark" style={[styles.shopPanel, { borderColor: '#00f2fe' }]}>
                                <Text style={[styles.shopTitle, { color: '#00f2fe' }]}>GÖREVLER</Text>
                                <Text style={styles.shopSubtitle}>Tamamla ve ödülü kap!</Text>
                                
                                {missions.map(m => (
                                    <View key={m.id} style={styles.shopItem}>
                                        <View style={{flex: 1}}>
                                            <Text style={styles.shopItemText}>{m.title}</Text>
                                            <Text style={styles.shopItemDesc}>İlerleme: {m.progress} / {m.target}</Text>
                                        </View>
                                        {m.completed ? (
                                            <TouchableOpacity onPress={() => claimReward(m.id, m.reward)}>
                                                <LinearGradient colors={['#11998e', '#38ef7d']} style={styles.claimButton}>
                                                    <Text style={styles.claimText}>AL</Text>
                                                </LinearGradient>
                                            </TouchableOpacity>
                                        ) : (
                                            <View style={{ alignItems: 'center' }}>
                                                <Text style={{color: '#f1c40f', fontWeight: 'bold', fontSize: 18}}>🪙 {m.reward}</Text>
                                            </View>
                                        )}
                                    </View>
                                ))}

                                <TouchableOpacity style={{marginTop: 20, width: '100%'}} onPress={() => setMissionsVisible(false)}>
                                    <LinearGradient colors={['#ff0844', '#ffb199']} style={styles.gradientButton}>
                                        <Text style={styles.buttonText}>KAPAT</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </BlurView>
                        </View>
                    </Modal>
                )}

                {slotVisible && (
                    <Modal transparent={true} animationType="fade">
                        <View style={styles.fullScreen}>
                            <BlurView intensity={90} tint="dark" style={[styles.shopPanel, { borderColor: '#b224ef' }]}>
                                <Text style={[styles.shopTitle, { color: '#e0c3fc' }]}>🎰 SLOT MAKİNESİ</Text>
                                <Text style={styles.shopSubtitle}>Mevcut Altın: 🪙 {coins}</Text>

                                <View style={styles.slotContainer}>
                                    <View style={styles.reelBox}><Text style={styles.reelText}>{reels[0]}</Text></View>
                                    <View style={styles.reelBox}><Text style={styles.reelText}>{reels[1]}</Text></View>
                                    <View style={styles.reelBox}><Text style={styles.reelText}>{reels[2]}</Text></View>
                                </View>

                                <View style={styles.slotResultBox}>
                                    <Text style={styles.slotResultText}>{slotResultText}</Text>
                                </View>

                                <TouchableOpacity disabled={isSpinning} style={{width: '100%'}} onPress={playSlot}>
                                    <LinearGradient colors={isSpinning ? ['#8e9eab', '#eef2f3'] : ['#f6d365', '#fda085']} style={styles.gradientButton}>
                                        <Text style={[styles.buttonText, {color: '#2c3e50'}]}>{isSpinning ? 'DÖNÜYOR...' : 'KOLU ÇEK (5 🪙)'}</Text>
                                    </LinearGradient>
                                </TouchableOpacity>

                                <TouchableOpacity style={{marginTop: 20, width: '100%'}} onPress={() => setSlotVisible(false)} disabled={isSpinning}>
                                    <LinearGradient colors={['#ff0844', '#ffb199']} style={styles.gradientButton}>
                                        <Text style={styles.buttonText}>KAPAT</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </BlurView>
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
    scoreText: { fontSize: 70, fontWeight: '900', color: 'white', textShadowColor: 'black', textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 10, fontFamily: 'monospace' },
    coinHUD: { position: 'absolute', top: 40, right: 20 },
    coinText: { fontSize: 28, fontWeight: 'bold', color: '#ffcc00', textShadowColor: '#000', textShadowOffset: {width:2, height:2}, textShadowRadius: 4 },
    batMultiplier: { color: '#00f2fe', fontWeight: 'bold', fontSize: 16, textAlign: 'right', textShadowColor: 'black', textShadowRadius: 2 },
    pauseButton: { position: 'absolute', top: 40, left: 20 },
    glassBadge: { padding: 10, borderRadius: 15, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
    pauseText: { fontSize: 20 },
    shieldHUD: { position: 'absolute', top: 100, right: 20 },
    gravityHUD: { position: 'absolute', top: 160, right: 20 },
    magnetHUD: { position: 'absolute', top: 220, right: 20 },
    powerText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
    fullScreen: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
    gameOverPanel: { padding: 35, borderRadius: 25, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', width: '90%', maxWidth: 400, overflow: 'hidden' },
    gameOverTitle: { fontSize: 36, fontWeight: '900', color: '#fff', marginBottom: 20, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 4 },
    scoreBoardGlass: { backgroundColor: 'rgba(255,255,255,0.1)', width: '100%', borderRadius: 15, padding: 20, marginBottom: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
    scoreLabel: { fontSize: 20, fontWeight: '700', color: '#f1c40f' },
    scoreValue: { fontSize: 26, fontWeight: '900', color: 'white' },
    gradientButton: { paddingHorizontal: 30, paddingVertical: 18, borderRadius: 15, alignItems: 'center', justifyContent: 'center', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, width: '100%' },
    gradientButtonSmall: { paddingHorizontal: 10, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    actionRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 20 },
    thirdButtonWrapper: { flex: 1, marginHorizontal: 4 },
    buttonText: { color: 'white', fontSize: 20, fontWeight: '900' },
    buttonTextMicro: { color: 'white', fontSize: 13, fontWeight: '900' },
    shopPanel: { padding: 30, borderRadius: 25, alignItems: 'center', width: '90%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
    shopTitle: { color: '#f6d365', fontSize: 30, fontWeight: '900', marginBottom: 10, textShadowColor: 'black', textShadowRadius: 3 },
    shopSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 18, marginBottom: 25, fontWeight: '600' },
    shopItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', width: '100%', padding: 15, borderRadius: 15, marginVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    shopEmoji: { fontSize: 35, marginRight: 15 },
    shopItemText: { color: 'white', fontSize: 18, fontWeight: '800' },
    shopItemDesc: { color: '#bdc3c7', fontSize: 12, marginTop: 4 },
    claimButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
    claimText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    slotContainer: { flexDirection: 'row', justifyContent: 'center', marginVertical: 25 },
    reelBox: { backgroundColor: 'rgba(255,255,255,0.9)', padding: 15, marginHorizontal: 8, borderRadius: 15, borderWidth: 2, borderColor: '#f1c40f', width: 85, height: 85, justifyContent: 'center', alignItems: 'center', elevation: 5 },
    reelText: { fontSize: 50 },
    slotResultBox: { backgroundColor: 'rgba(0,0,0,0.5)', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', marginBottom: 25, width: '100%', alignItems: 'center' },
    slotResultText: { color: '#f1c40f', fontSize: 22, fontWeight: '900', textAlign: 'center' }
});
