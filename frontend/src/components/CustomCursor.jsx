import React, { useEffect, useState, useRef } from 'react';

const CustomCursor = () => {
    const dotRef = useRef(null);
    const outlineRef = useRef(null);
    const [isPointer, setIsPointer] = useState(false);
    const [isHidden, setIsHidden] = useState(true);

    useEffect(() => {
        const onMouseMove = (e) => {
            setIsHidden(false);
            const { clientX, clientY } = e;

            if (dotRef.current) {
                dotRef.current.style.transform = `translate3d(${clientX}px, ${clientY}px, 0)`;
            }
            if (outlineRef.current) {
                // Add a slight delay/inertia for the outline
                outlineRef.current.animate({
                    transform: `translate3d(${clientX}px, ${clientY}px, 0)`
                }, { duration: 500, fill: 'forwards' });
            }

            // Check if hovering over clickable elements
            const target = e.target;
            const isClickable = target.closest('button, a, .content-type-item, .history-item, input, .category-header');
            setIsPointer(!!isClickable);
        };

        const onMouseLeave = () => setIsHidden(true);
        const onMouseEnter = () => setIsHidden(false);

        // Don't initialize cursor if it's a touch device
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            return;
        }

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseenter', onMouseEnter);
        window.addEventListener('mouseleave', onMouseLeave);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseenter', onMouseEnter);
            window.removeEventListener('mouseleave', onMouseLeave);
        };
    }, []);

    // Also check for touch capability during render
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) return null;

    return (
        <>
            <div
                ref={dotRef}
                className={`cursor-dot ${isHidden ? 'hidden' : ''} ${isPointer ? 'pointer' : ''}`}
            />
            <div
                ref={outlineRef}
                className={`cursor-outline ${isHidden ? 'hidden' : ''} ${isPointer ? 'pointer' : ''}`}
            />
        </>
    );
};

export default CustomCursor;
