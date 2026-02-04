import React from 'react';

const AuraBackground: React.FC = () => {
    return (
        <div className="fixed inset-0 w-full h-full bg-[#0F172A] -z-10 overflow-hidden">
            {/* Animated Light Blobs */}
            <div
                className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-600/20 blur-[120px] animate-pulse"
                style={{ animationDuration: '8s' }}
            />
            <div
                className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[100px] animate-pulse"
                style={{ animationDuration: '12s', animationDelay: '2s' }}
            />

            {/* Subtle Moving Gradient */}
            <div className="absolute inset-0 opacity-30">
                <div
                    className="absolute inset-x-0 top-0 h-full bg-gradient-to-b from-blue-900/20 via-transparent to-slate-900/50"
                />
            </div>

            {/* Noise/Grain Overlay for texture */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay">
                <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                    <filter id="noise">
                        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
                    </filter>
                    <rect width="100%" height="100%" filter="url(#noise)" />
                </svg>
            </div>
        </div>
    );
};

export default AuraBackground;
