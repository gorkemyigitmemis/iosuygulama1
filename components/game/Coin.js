import React from 'react';
import { View, Text } from 'react-native';
import Matter from 'matter-js';

const CoinRenderer = (props) => {
    const widthBody = props.body.bounds.max.x - props.body.bounds.min.x;
    const heightBody = props.body.bounds.max.y - props.body.bounds.min.y;
    const xBody = props.body.position.x - widthBody / 2;
    const yBody = props.body.position.y - heightBody / 2;

    if (!props.active) return null;

    return (
        <View style={{
            position: 'absolute', left: xBody, top: yBody, width: widthBody, height: heightBody,
            justifyContent: 'center', alignItems: 'center'
        }}>
            <Text style={{fontSize: 35}}>🪙</Text>
        </View>
    );
};

export default (world, pos) => {
    const body = Matter.Bodies.rectangle(pos.x, pos.y, 40, 40, { label: 'Coin', isSensor: true });
    Matter.World.add(world, body);
    return { body, active: true, renderer: <CoinRenderer /> };
};
