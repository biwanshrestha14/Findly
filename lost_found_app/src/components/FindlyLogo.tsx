import React from 'react';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

interface LogoProps {
    size?: number;
}

export default function FindlyLogo({ size = 120 }: LogoProps) {
    return (
        <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
            <Defs>
                <LinearGradient id="gradientLogo" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="#0F6E56" />
                    <Stop offset="100%" stopColor="#128C7E" />
                </LinearGradient>
                <LinearGradient id="gradientCircle" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="#3498db" />
                    <Stop offset="100%" stopColor="#2980b9" />
                </LinearGradient>
            </Defs>
            
            {/* Outer soft radar circle */}
            <Circle cx="50" cy="50" r="45" stroke="url(#gradientLogo)" strokeWidth="1.5" strokeDasharray="6,4" opacity="0.4" />
            <Circle cx="50" cy="50" r="36" stroke="url(#gradientLogo)" strokeWidth="0.8" opacity="0.3" />

            {/* Glowing accent circle */}
            <Circle cx="70" cy="30" r="6" fill="url(#gradientCircle)" opacity="0.8" />
            
            {/* Findly magnifying pin logo path */}
            <Path 
                d="M50 15C33.43 15 20 28.43 20 45C20 63.75 44 85 50 85C56 85 80 63.75 80 45C80 28.43 66.57 15 50 15ZM50 60C41.72 60 35 53.28 35 45C35 36.72 41.72 30 50 30C58.28 30 65 36.72 65 45C65 53.28 58.28 60 50 60Z" 
                fill="url(#gradientLogo)"
            />

            {/* The magnifying handle */}
            <Path 
                d="M60.6 55.6L72 67" 
                stroke="url(#gradientLogo)" 
                strokeWidth="7" 
                strokeLinecap="round" 
            />
            {/* Magnifying handle highlight */}
            <Path 
                d="M60.6 55.6L72 67" 
                stroke="#fff" 
                strokeWidth="2" 
                strokeLinecap="round" 
                opacity="0.4"
            />
            
            {/* Internal success shine/star */}
            <Path 
                d="M50 39L51.5 42.5L55 42.5L52.2 44.5L53.5 48L50 45.8L46.5 48L47.8 44.5L45 42.5L48.5 42.5Z" 
                fill="#FFF" 
            />
        </Svg>
    );
}
