
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface DashboardBannerProps {
    imageUrl: string;
    link?: string;
}

const DashboardBanner = ({ imageUrl, link }: DashboardBannerProps) => {
    const [isVisible, setIsVisible] = useState(true);

    const handleClose = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsVisible(false);
    };

    if (!isVisible) return null;

    const BannerContent = (
        <div className="relative w-full overflow-hidden rounded-2xl group transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/10 border border-white/10">
            <img
                src={imageUrl}
                alt="Dashboard Banner"
                className="w-full h-auto object-cover aspect-[1440/300] transition-transform duration-700 group-hover:scale-105"
            />
            <button
                onClick={handleClose}
                className="absolute top-4 right-4 p-2 bg-black/20 backdrop-blur-md text-white/80 hover:text-white hover:bg-black/40 rounded-full transition-all z-20"
            >
                <X size={20} />
            </button>
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
        </div>
    );

    return (
        <div className="w-full mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
            {link ? (
                <a href={link} target="_blank" rel="noopener noreferrer" className="block focus:outline-none">
                    {BannerContent}
                </a>
            ) : (
                BannerContent
            )}
        </div>
    );
};

export default DashboardBanner;
