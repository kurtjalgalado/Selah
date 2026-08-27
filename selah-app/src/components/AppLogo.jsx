import React from 'react';

export default function AppLogo({ showText = true, textClassName = '', onClick }) {
    return (
        <div
            className={`flex flex-col select-none inline-flex ${onClick ? 'cursor-pointer active:scale-95 transition-transform' : ''}`}
            onClick={onClick}
        >
            <h1 className={`font-serif font-bold text-accent tracking-tight leading-none ${textClassName || 'text-2xl'}`}>
                Selah
            </h1>
            <p className="text-[9px] text-textmuted tracking-widest uppercase font-semibold mt-0.5">
                Worship Planner
            </p>
        </div>
    );
}
