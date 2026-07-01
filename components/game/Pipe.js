import Matter from 'matter-js';
import React from 'react';
import { Image } from 'react-native';

const Pipe = (props) => {
    const widthBody = props.body.bounds.max.x - props.body.bounds.min.x;
    const heightBody = props.body.bounds.max.y - props.body.bounds.min.y;

    const xBody = props.body.position.x - widthBody / 2;
    const yBody = props.body.position.y - heightBody / 2;

    return (
        <Image
            source={require('../../assets/images/pipe.png')}
            style={{
                position: 'absolute',
                left: xBody,
                top: yBody,
                width: widthBody,
                height: heightBody,
                resizeMode: 'stretch',
                transform: props.isTop ? [{ rotate: '180deg' }] : []
            }}
        />
    );
};

export default (world, label, pos, size, isTop = false) => {
    const initialPipe = Matter.Bodies.rectangle(
        pos.x,
        pos.y,
        size.width,
        size.height,
        { label, isStatic: true }
    );
    Matter.World.add(world, initialPipe);

    return {
        body: initialPipe,
        isTop,
        renderer: <Pipe />
    };
};
