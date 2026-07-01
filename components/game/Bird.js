import Matter from 'matter-js';
import React from 'react';
import { Image, Text, View } from 'react-native';

const BirdRenderer = (props) => {
    const widthBody = props.body.bounds.max.x - props.body.bounds.min.x;
    const heightBody = props.body.bounds.max.y - props.body.bounds.min.y;
    const xBody = props.body.position.x - widthBody / 2;
    const yBody = props.body.position.y - heightBody / 2;
    
    let rotation = props.body.velocity.y * 6; 
    if (rotation < -25) rotation = -25;
    if (rotation > 90) rotation = 90;

    // Ters yerçekiminde dönüşü tersine çevir
    if (props.gravityInverted) {
        rotation = -rotation;
    }

    let content = null;
    if (props.skin === 'spaceship') {
        content = <Text style={{fontSize: heightBody}}>🚀</Text>;
    } else if (props.skin === 'bat') {
        content = <Text style={{fontSize: heightBody}}>🦇</Text>;
    } else {
        content = <Image source={require('../../assets/images/bird.png')} style={{width: widthBody, height: heightBody, resizeMode: 'stretch'}} />;
    }

    return (
        <View style={{
            position: 'absolute', left: xBody, top: yBody, width: widthBody, height: heightBody,
            justifyContent: 'center', alignItems: 'center',
            transform: [{ rotate: `${rotation}deg` }]
        }}>
            {content}
            {props.hasShield && (
                <View style={{
                    position: 'absolute', 
                    width: widthBody + 20, 
                    height: heightBody + 20, 
                    borderRadius: 50, 
                    borderWidth: 3, 
                    borderColor: 'cyan', 
                    backgroundColor: 'rgba(0,255,255,0.3)'
                }} />
            )}
        </View>
    );
};

export default (world, color, pos, size, skin = 'bird') => {
    const initialBird = Matter.Bodies.rectangle(pos.x, pos.y, size.width, size.height, { label: 'Bird' });
    Matter.World.add(world, initialBird);
    return { body: initialBird, color, pos, skin, hasShield: false, gravityInverted: false, renderer: <BirdRenderer /> };
};
