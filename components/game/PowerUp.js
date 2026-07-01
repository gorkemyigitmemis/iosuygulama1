import React from 'react';
import { View, Text } from 'react-native';
import Matter from 'matter-js';

const PowerUpRenderer = (props) => {
    const widthBody = props.body.bounds.max.x - props.body.bounds.min.x;
    const heightBody = props.body.bounds.max.y - props.body.bounds.min.y;
    const xBody = props.body.position.x - widthBody / 2;
    const yBody = props.body.position.y - heightBody / 2;

    if (!props.active) return null;

    return (
        <View style={{
            position: 'absolute', left: xBody, top: yBody, width: widthBody, height: heightBody,
            justifyContent: 'center', alignItems: 'center',
            backgroundColor: props.type === 'shield' ? 'rgba(0,150,255,0.7)' : props.type === 'magnet' ? 'rgba(255,100,0,0.7)' : 'rgba(200,0,200,0.7)',
            borderRadius: 25,
            borderWidth: 2,
            borderColor: 'white'
        }}>
            <Text style={{fontSize: 25}}>{props.type === 'shield' ? '🛡️' : props.type === 'magnet' ? '🧲' : '🔄'}</Text>
        </View>
    );
};

export default (world, pos, type) => {
    const body = Matter.Bodies.rectangle(pos.x, pos.y, 50, 50, { label: 'PowerUp', isSensor: true, isStatic: true, powerUpType: type });
    Matter.World.add(world, body);
    return { body, active: true, type, renderer: <PowerUpRenderer /> };
};
