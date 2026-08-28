console.log("CJ Trace démarré");


/* =========================================================
   ELEMENTS DE LA PAGE
========================================================= */

const imagePicker =
    document.getElementById("imagePicker");

const chooseImage =
    document.getElementById("chooseImage");

const changeImage =
    document.getElementById("changeImage");

const previewImage =
    document.getElementById("previewImage");

const homeScreen =
    document.getElementById("homeScreen");

const previewScreen =
    document.getElementById("previewScreen");

const startAR =
    document.getElementById("startAR");

const status =
    document.getElementById("status");


let selectedImage = null;



/* =========================================================
   CHOIX DE L'IMAGE
========================================================= */

chooseImage.addEventListener(
    "click",
    () => {

        imagePicker.click();

    }
);


changeImage.addEventListener(
    "click",
    () => {

        imagePicker.click();

    }
);


imagePicker.addEventListener(
    "change",
    event => {

        const file =
            event.target.files[0];


        if (!file) {
            return;
        }


        if (
            !file.type.startsWith("image/")
        ) {

            status.textContent =
                "Ce fichier n'est pas une image.";

            return;
        }


        if (selectedImage) {

            URL.revokeObjectURL(
                selectedImage
            );

        }


        selectedImage =
            URL.createObjectURL(file);


        previewImage.src =
            selectedImage;


        homeScreen.classList.add(
            "hidden"
        );


        previewScreen.classList.remove(
            "hidden"
        );


        status.textContent =
            "Image prête pour le mode AR.";

    }
);



/* =========================================================
   BOUTON COMMENCER
========================================================= */

startAR.addEventListener(
    "click",
    async () => {

        if (!selectedImage) {

            status.textContent =
                "Choisis d'abord une image.";

            return;

        }


        if (!navigator.xr) {

            status.textContent =
                "WebXR n'est pas disponible sur cet appareil.";

            return;

        }


        try {

            const supported =
                await navigator.xr.isSessionSupported(
                    "immersive-ar"
                );


            if (!supported) {

                status.textContent =
                    "Le mode AR immersif n'est pas disponible ici.";

                return;

            }


            status.textContent =
                "Ouverture du mode AR...";


            await startARSession();


        } catch (error) {

            console.error(error);


            status.textContent =
                "Impossible de lancer le mode AR.";

        }

    }
);



/* =========================================================
   SESSION AR
========================================================= */

async function startARSession() {

    let session = null;


    try {

        /*
          IMPORTANT :
          requestSession doit rester lié au clic utilisateur.
        */

        session =
            await navigator.xr.requestSession(
                "immersive-ar",
                {

                    optionalFeatures: [

                        "local-floor",
                        "bounded-floor",
                        "hand-tracking"

                    ]

                }
            );



        /* =================================================
           SCENE
        ================================================= */

        const scene =
            new THREE.Scene();



        /* =================================================
           CAMERA
        ================================================= */

        const camera =
            new THREE.PerspectiveCamera(

                70,

                window.innerWidth /
                window.innerHeight,

                0.01,

                100

            );



        /* =================================================
           RENDERER
        ================================================= */

        const renderer =
            new THREE.WebGLRenderer({

                alpha: true,

                antialias: true

            });


        renderer.setPixelRatio(
            window.devicePixelRatio
        );


        renderer.setSize(

            window.innerWidth,

            window.innerHeight

        );


        renderer.xr.enabled =
            true;


        renderer.xr.setReferenceSpaceType(
            "local"
        );



        /* =================================================
           CHARGEMENT IMAGE
        ================================================= */

        const textureLoader =
            new THREE.TextureLoader();


        const texture =
            await textureLoader.loadAsync(
                selectedImage
            );


        texture.colorSpace =
            THREE.SRGBColorSpace;



        /* =================================================
           DIMENSIONS IMAGE
        ================================================= */

        const imageWidth =
            texture.image.width;


        const imageHeight =
            texture.image.height;


        const ratio =
            imageWidth /
            imageHeight;


        const planeHeight =
            0.8;


        const planeWidth =
            planeHeight *
            ratio;



        /* =================================================
           GEOMETRIE DU DESSIN
        ================================================= */

        const geometry =
            new THREE.PlaneGeometry(

                planeWidth,

                planeHeight

            );



        /* =================================================
           MATERIAU
        ================================================= */

        const material =
            new THREE.MeshBasicMaterial({

                map:
                    texture,

                transparent:
                    true,

                opacity:
                    0.40,

                side:
                    THREE.DoubleSide

            });



        /* =================================================
           DESSIN
        ================================================= */

        const drawing =
            new THREE.Mesh(

                geometry,

                material

            );


        drawing.position.set(

            0,

            0,

            -1.5

        );


        scene.add(
            drawing
        );



        /* =================================================
           CONTROLEUR PICO
        ================================================= */

        const controller =
            renderer.xr.getController(0);


        scene.add(
            controller
        );



        /* =================================================
           RAYON BLANC
        ================================================= */

        const rayGeometry =
            new THREE.BufferGeometry()
                .setFromPoints([

                    new THREE.Vector3(
                        0,
                        0,
                        0
                    ),

                    new THREE.Vector3(
                        0,
                        0,
                        -3
                    )

                ]);


        const rayMaterial =
            new THREE.LineBasicMaterial({

                color:
                    0xffffff

            });


        const controllerRay =
            new THREE.Line(

                rayGeometry,

                rayMaterial

            );


        controller.add(
            controllerRay
        );



        /* =================================================
           VARIABLES DE DEPLACEMENT
        ================================================= */

        const raycaster =
            new THREE.Raycaster();


        const tempMatrix =
            new THREE.Matrix4();


        const rayOrigin =
            new THREE.Vector3();


        const rayDirection =
            new THREE.Vector3();


        const grabOffset =
            new THREE.Vector3();


        let isDragging =
            false;


        let grabDistance =
            1.5;



        /* =================================================
           ETAT GENERAL
        ================================================= */

        let tiltMode =
            false;


        let isLocked =
            false;


        let menuOpen =
            false;


        let opacityPlusPressed =
            false;


        let opacityMinusPressed =
            false;



        /* =================================================
           CREATION TEXTURES DU MENU
        ================================================= */

        function createCanvasTexture({

            width = 1024,

            height = 512,

            background =
                "rgba(20,20,30,0.94)",

            border =
                "rgba(255,255,255,0.30)",

            title = "",

            lines = [],

            titleSize = 70,

            lineSize = 40,

            centered = false

        }) {

            const canvas =
                document.createElement(
                    "canvas"
                );


            canvas.width =
                width;


            canvas.height =
                height;


            const ctx =
                canvas.getContext(
                    "2d"
                );


            ctx.clearRect(
                0,
                0,
                width,
                height
            );


            ctx.fillStyle =
                background;


            ctx.fillRect(
                0,
                0,
                width,
                height
            );


            ctx.strokeStyle =
                border;


            ctx.lineWidth =
                8;


            ctx.strokeRect(

                4,

                4,

                width - 8,

                height - 8

            );


            ctx.fillStyle =
                "#ffffff";


            ctx.textBaseline =
                "middle";


            if (title) {

                ctx.font =
                    `700 ${titleSize}px Arial`;


                ctx.textAlign =
                    centered
                        ? "center"
                        : "left";


                ctx.fillText(

                    title,

                    centered
                        ? width / 2
                        : 55,

                    85

                );

            }


            ctx.font =
                `500 ${lineSize}px Arial`;


            ctx.textAlign =
                centered
                    ? "center"
                    : "left";


            const startY =
                title
                    ? 175
                    : height / 2;


            const spacing =
                lineSize * 1.45;


            lines.forEach(
                (line, index) => {

                    ctx.fillText(

                        line,

                        centered
                            ? width / 2
                            : 55,

                        startY +
                        index *
                        spacing

                    );

                }
            );


            const canvasTexture =
                new THREE.CanvasTexture(
                    canvas
                );


            canvasTexture.colorSpace =
                THREE.SRGBColorSpace;


            canvasTexture.needsUpdate =
                true;


            return canvasTexture;

        }



        /* =================================================
           CREATION PLANE HUD
        ================================================= */

        function createHudPlane(
            width,
            height,
            textureMap
        ) {

            const hudGeometry =
                new THREE.PlaneGeometry(

                    width,

                    height

                );


            const hudMaterial =
                new THREE.MeshBasicMaterial({

                    map:
                        textureMap,

                    transparent:
                        true,

                    side:
                        THREE.DoubleSide,

                    depthTest:
                        false,

                    depthWrite:
                        false

                });


            const mesh =
                new THREE.Mesh(

                    hudGeometry,

                    hudMaterial

                );


            mesh.renderOrder =
                1000;


            scene.add(
                mesh
            );


            return mesh;

        }



        /* =================================================
           PETIT BOUTON ?
        ================================================= */

        const menuButtonTexture =
            createCanvasTexture({

                width:
                    256,

                height:
                    256,

                background:
                    "rgba(80,35,180,0.96)",

                title:
                    "?",

                titleSize:
                    150,

                centered:
                    true

            });


        const menuButton =
            createHudPlane(

                0.12,

                0.12,

                menuButtonTexture

            );



        /* =================================================
           PANNEAU AIDE
        ================================================= */

        const helpPanelTexture =
            createCanvasTexture({

                width:
                    1200,

                height:
                    900,

                title:
                    "CJ TRACE - COMMANDES",

                titleSize:
                    62,

                lineSize:
                    39,

                lines: [

                    "Gâchette avant + viser : déplacer",

                    "Joystick haut / bas : taille",

                    "Joystick gauche / droite : rotation",

                    "Grip + joystick H/B : inclinaison AV/AR",

                    "Grip + joystick G/D : inclinaison latérale",

                    "A / B ou X / Y : opacité + / -",

                    "VERROUILLER : bloque tous les réglages"

                ]

            });


        const helpPanel =
            createHudPlane(

                0.78,

                0.58,

                helpPanelTexture

            );


        helpPanel.visible =
            false;



        /* =================================================
           BOUTON VERROUILLER
        ================================================= */

        function createLockTexture() {

            return createCanvasTexture({

                width:
                    900,

                height:
                    220,

                background:
                    isLocked

                        ? "rgba(150,45,45,0.96)"

                        : "rgba(35,125,70,0.96)",

                title:
                    isLocked

                        ? "DEVERROUILLER"

                        : "VERROUILLER",

                titleSize:
                    70,

                centered:
                    true

            });

        }


        let lockButtonTexture =
            createLockTexture();


        const lockButton =
            createHudPlane(

                0.44,

                0.105,

                lockButtonTexture

            );


        lockButton.visible =
            false;



        /* =================================================
           RAFRAICHIR BOUTON LOCK
        ================================================= */

        function refreshLockButton() {

            const oldTexture =
                lockButton.material.map;


            lockButtonTexture =
                createLockTexture();


            lockButton.material.map =
                lockButtonTexture;


            lockButton.material.needsUpdate =
                true;


            if (oldTexture) {

                oldTexture.dispose();

            }

        }



        /* =================================================
           OUVRIR / FERMER MENU
        ================================================= */

        function setMenuOpen(open) {

            menuOpen =
                open;


            helpPanel.visible =
                menuOpen;


            lockButton.visible =
                menuOpen;

        }



        /* =================================================
           VERROUILLER / DEVERROUILLER
        ================================================= */

        function toggleLock() {

            isLocked =
                !isLocked;


            isDragging =
                false;


            tiltMode =
                false;


            refreshLockButton();


            console.log(

                isLocked

                    ? "CJ Trace verrouillé"

                    : "CJ Trace déverrouillé"

            );

        }



        /* =================================================
           HUD QUI SUIT LA TETE
        ================================================= */

        const hudHeadPosition =
            new THREE.Vector3();


        const hudHeadQuaternion =
            new THREE.Quaternion();


        const hudOffset =
            new THREE.Vector3();



        function placeHudElement(
            mesh,
            x,
            y,
            z
        ) {

            hudOffset

                .set(
                    x,
                    y,
                    z
                )

                .applyQuaternion(
                    hudHeadQuaternion
                );


            mesh.position

                .copy(
                    hudHeadPosition
                )

                .add(
                    hudOffset
                );


            mesh.quaternion.copy(
                hudHeadQuaternion
            );

        }



        function updateHud() {

            const xrCamera =
                renderer.xr.getCamera(
                    camera
                );


            xrCamera.getWorldPosition(
                hudHeadPosition
            );


            xrCamera.getWorldQuaternion(
                hudHeadQuaternion
            );


            /*
              Petit ? en bas à droite.
            */

            placeHudElement(

                menuButton,

                0.32,

                -0.20,

                -0.72

            );


            if (menuOpen) {

                placeHudElement(

                    helpPanel,

                    0,

                    0.03,

                    -0.92

                );


                placeHudElement(

                    lockButton,

                    0,

                    -0.31,

                    -0.90

                );

            }

        }



        /* =================================================
           CALCUL RAYON MANETTE
        ================================================= */

        function updateControllerRay() {

            tempMatrix

                .identity()

                .extractRotation(
                    controller.matrixWorld
                );


            rayOrigin
                .setFromMatrixPosition(
                    controller.matrixWorld
                );


            rayDirection

                .set(
                    0,
                    0,
                    -1
                )

                .applyMatrix4(
                    tempMatrix
                )

                .normalize();


            raycaster.ray.origin.copy(
                rayOrigin
            );


            raycaster.ray.direction.copy(
                rayDirection
            );

        }



        /* =================================================
           GACHETTE AVANT
        ================================================= */

        controller.addEventListener(
            "selectstart",
            () => {

                updateControllerRay();



                /* -----------------------------------------
                   D'ABORD : INTERFACE
                ----------------------------------------- */

                const uiObjects =
                    [menuButton];


                if (menuOpen) {

                    uiObjects.push(
                        lockButton
                    );

                }


                const uiHits =
                    raycaster.intersectObjects(

                        uiObjects.filter(
                            object =>
                                object.visible
                        ),

                        false

                    );


                if (
                    uiHits.length > 0
                ) {

                    const object =
                        uiHits[0].object;


                    /*
                      Clic sur ?
                    */

                    if (
                        object ===
                        menuButton
                    ) {

                        setMenuOpen(
                            !menuOpen
                        );

                        return;

                    }


                    /*
                      Clic sur verrouillage
                    */

                    if (
                        object ===
                        lockButton
                    ) {

                        toggleLock();

                        return;

                    }

                }



                /* -----------------------------------------
                   SI VERROUILLE
                ----------------------------------------- */

                if (isLocked) {

                    return;

                }



                /* -----------------------------------------
                   SAISIR DESSIN
                ----------------------------------------- */

                const intersections =
                    raycaster.intersectObject(

                        drawing,

                        false

                    );


                if (
                    intersections.length ===
                    0
                ) {

                    return;

                }


                isDragging =
                    true;


                grabDistance =
                    intersections[0]
                        .distance;


                const targetPoint =
                    rayOrigin

                        .clone()

                        .add(

                            rayDirection

                                .clone()

                                .multiplyScalar(
                                    grabDistance
                                )

                        );


                grabOffset

                    .copy(
                        drawing.position
                    )

                    .sub(
                        targetPoint
                    );

            }
        );



        /* =================================================
           RELACHER
        ================================================= */

        controller.addEventListener(
            "selectend",
            () => {

                isDragging =
                    false;

            }
        );



        /* =================================================
           GRIP = MODE INCLINAISON
        ================================================= */

        controller.addEventListener(
            "squeezestart",
            () => {

                if (isLocked) {

                    return;

                }


                tiltMode =
                    true;

            }
        );


        controller.addEventListener(
            "squeezeend",
            () => {

                tiltMode =
                    false;

            }
        );



        /* =================================================
           ACTIVE LA SESSION THREE
        ================================================= */

        await renderer.xr.setSession(
            session
        );



        /* =================================================
           BOUCLE XR
        ================================================= */

        let previousTime =
            performance.now();


        renderer.setAnimationLoop(
            () => {

                const now =
                    performance.now();


                const delta =
                    Math.min(

                        (
                            now -
                            previousTime
                        )
                        / 1000,

                        0.1

                    );


                previousTime =
                    now;



                /* =========================================
                   MENU
                ========================================= */

                updateHud();



                /* =========================================
                   DEPLACEMENT
                ========================================= */

                updateControllerRay();


                if (
                    isDragging &&
                    !isLocked
                ) {

                    const newPosition =
                        rayOrigin

                            .clone()

                            .add(

                                rayDirection

                                    .clone()

                                    .multiplyScalar(
                                        grabDistance
                                    )

                            )

                            .add(
                                grabOffset
                            );


                    drawing.position.copy(
                        newPosition
                    );

                }



                /* =========================================
                   GAMEPAD
                ========================================= */

                for (
                    const inputSource
                    of session.inputSources
                ) {

                    if (
                        inputSource.targetRayMode !==
                        "tracked-pointer"
                    ) {

                        continue;

                    }


                    const gamepad =
                        inputSource.gamepad;


                    if (!gamepad) {

                        continue;

                    }


                    const axes =
                        gamepad.axes;


                    if (
                        !axes ||
                        axes.length < 2
                    ) {

                        continue;

                    }


                    const stickX =
                        axes[
                            axes.length - 2
                        ];


                    const stickY =
                        axes[
                            axes.length - 1
                        ];


                    const deadZone =
                        0.25;



                    /* =====================================
                       TOUT BLOQUE SI VERROUILLE
                    ===================================== */

                    if (!isLocked) {


                        /* ---------------------------------
                           MODE NORMAL
                        --------------------------------- */

                        if (!tiltMode) {


                            /*
                              TAILLE
                            */

                            if (
                                Math.abs(
                                    stickY
                                ) >
                                deadZone
                            ) {

                                let scale =
                                    drawing.scale.x;


                                scale +=

                                    (-stickY)

                                    * delta

                                    * 0.8;


                                scale =
                                    THREE.MathUtils.clamp(

                                        scale,

                                        0.15,

                                        5

                                    );


                                drawing.scale.set(

                                    scale,

                                    scale,

                                    scale

                                );

                            }


                            /*
                              ROTATION A PLAT
                            */

                            if (
                                Math.abs(
                                    stickX
                                ) >
                                deadZone
                            ) {

                                drawing.rotation.z +=

                                    (-stickX)

                                    * delta

                                    * 1.2;

                            }

                        }



                        /* ---------------------------------
                           MODE INCLINAISON
                        --------------------------------- */

                        if (tiltMode) {


                            /*
                              AVANT / ARRIERE
                            */

                            if (
                                Math.abs(
                                    stickY
                                ) >
                                deadZone
                            ) {

                                drawing.rotation.x +=

                                    (-stickY)

                                    * delta

                                    * 0.9;

                            }


                            /*
                              GAUCHE / DROITE
                            */

                            if (
                                Math.abs(
                                    stickX
                                ) >
                                deadZone
                            ) {

                                drawing.rotation.y +=

                                    (-stickX)

                                    * delta

                                    * 0.9;

                            }


                            const maxTilt =
                                THREE.MathUtils.degToRad(
                                    75
                                );


                            drawing.rotation.x =
                                THREE.MathUtils.clamp(

                                    drawing.rotation.x,

                                    -maxTilt,

                                    maxTilt

                                );


                            drawing.rotation.y =
                                THREE.MathUtils.clamp(

                                    drawing.rotation.y,

                                    -maxTilt,

                                    maxTilt

                                );

                        }



                        /* ---------------------------------
                           OPACITE
                        --------------------------------- */

                        const buttons =
                            gamepad.buttons;


                        if (buttons) {

                            const plusButton =
                                buttons[4];


                            const minusButton =
                                buttons[5];


                            const plusNow =
                                Boolean(

                                    plusButton &&

                                    plusButton.pressed

                                );


                            if (
                                plusNow &&
                                !opacityPlusPressed
                            ) {

                                material.opacity +=
                                    0.10;


                                material.opacity =
                                    THREE.MathUtils.clamp(

                                        material.opacity,

                                        0.10,

                                        0.90

                                    );

                            }


                            opacityPlusPressed =
                                plusNow;



                            const minusNow =
                                Boolean(

                                    minusButton &&

                                    minusButton.pressed

                                );


                            if (
                                minusNow &&
                                !opacityMinusPressed
                            ) {

                                material.opacity -=
                                    0.10;


                                material.opacity =
                                    THREE.MathUtils.clamp(

                                        material.opacity,

                                        0.10,

                                        0.90

                                    );

                            }


                            opacityMinusPressed =
                                minusNow;

                        }

                    }


                    break;

                }



                /* =========================================
                   RENDU
                ========================================= */

                renderer.render(

                    scene,

                    camera

                );

            }
        );



        /* =================================================
           FIN DE SESSION
        ================================================= */

        session.addEventListener(
            "end",
            () => {

                renderer.setAnimationLoop(
                    null
                );


                geometry.dispose();

                material.dispose();

                texture.dispose();


                rayGeometry.dispose();

                rayMaterial.dispose();


                menuButton.geometry.dispose();

                menuButton.material.map?.dispose();

                menuButton.material.dispose();


                helpPanel.geometry.dispose();

                helpPanel.material.map?.dispose();

                helpPanel.material.dispose();


                lockButton.geometry.dispose();

                lockButton.material.map?.dispose();

                lockButton.material.dispose();


                renderer.dispose();


                status.textContent =
                    "Mode AR fermé.";

            }
        );


    } catch (error) {

        console.error(

            "Erreur CJ Trace AR :",

            error

        );


        if (session) {

            await session
                .end()
                .catch(
                    () => {}
                );

        }


        throw error;

    }

}