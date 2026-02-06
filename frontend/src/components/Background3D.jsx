import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const Background3D = () => {
    const containerRef = useRef();

    useEffect(() => {
        if (!containerRef.current) return;

        // Scene, Camera, Renderer
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        containerRef.current.appendChild(renderer.domElement);

        // Starfield
        const starGeometry = new THREE.BufferGeometry();
        const starCount = 3000;
        const starCoords = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount * 3; i++) {
            starCoords[i] = (Math.random() - 0.5) * 600;
        }
        starGeometry.setAttribute('position', new THREE.BufferAttribute(starCoords, 3));
        const starMaterial = new THREE.PointsMaterial({ color: 0x00d2ff, size: 0.5, transparent: true, opacity: 0.8 });
        const stars = new THREE.Points(starGeometry, starMaterial);
        scene.add(stars);

        // Floating Geometric Shapes
        const shapes = [];
        const geometries = [
            new THREE.IcosahedronGeometry(2, 0),
            new THREE.TetrahedronGeometry(1.5, 0),
            new THREE.BoxGeometry(2, 2, 2)
        ];

        for (let i = 0; i < 15; i++) {
            const geo = geometries[Math.floor(Math.random() * geometries.length)];
            const mat = new THREE.MeshPhongMaterial({
                color: 0x00d2ff,
                wireframe: true,
                transparent: true,
                opacity: 0.2
            });
            const mesh = new THREE.Mesh(geo, mat);

            mesh.position.set(
                (Math.random() - 0.5) * 100,
                (Math.random() - 0.5) * 100,
                (Math.random() - 0.5) * 100
            );
            mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

            scene.add(mesh);
            shapes.push({
                mesh,
                speedX: (Math.random() - 0.5) * 0.01,
                speedY: (Math.random() - 0.5) * 0.01,
                rotX: (Math.random() - 0.5) * 0.02,
                rotY: (Math.random() - 0.5) * 0.02
            });
        }

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);
        const pointLight = new THREE.PointLight(0x00d2ff, 1);
        pointLight.position.set(20, 20, 20);
        scene.add(pointLight);

        camera.position.z = 50;

        // Animation Loop
        const animate = () => {
            requestAnimationFrame(animate);

            stars.rotation.y += 0.0005;
            stars.rotation.x += 0.0002;

            shapes.forEach(s => {
                s.mesh.rotation.x += s.rotX;
                s.mesh.rotation.y += s.rotY;
                s.mesh.position.x += s.speedX;
                s.mesh.position.y += s.speedY;
            });

            renderer.render(scene, camera);
        };

        animate();

        // Resize Handling
        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };

        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            if (containerRef.current) {
                containerRef.current.removeChild(renderer.domElement);
            }
            scene.clear();
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className="background-3d-container"
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 0,
                pointerEvents: 'none',
                overflow: 'hidden'
            }}
        />
    );
};

export default Background3D;
