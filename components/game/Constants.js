import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export default {
    MAX_WIDTH: width,
    MAX_HEIGHT: height,
    GAP_SIZE: 250, 
    PIPE_WIDTH: 80,
    BIRD_WIDTH: 50,
    BIRD_HEIGHT: 41
};
