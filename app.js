console.log("CJ Trace démarré");


/* ==============================
   ELEMENTS INTERFACE
================================ */

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



/* ==============================
   CHOISIR IMAGE
================================ */

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
            !file.type.startsWith(
                "image/"
            )
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



/* ==============================
   COMMENCER
================================ */

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
                await navigator.xr
                    .isSessionSupported(
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

            console.error(
                error
            );


            status.textContent =
                "Impossible de lancer le mode AR.";

        }

    }
);



/* ==============================
   SESSION AR
================================ */

async function startARSession() {

    let session = null;


    try {

        /* ==============================
           OUVERTURE WEBXR
        ================================ */

        session =
            await navigator.xr
                .requestSession(
                    "immersive-ar",
                    {

                        optionalFeatures: [

                            "local-floor",
                            "bounded-floor",
                            "hand-tracking"

                        ]

                    }
                );


        /* ==============================
           SCENE
        ================================ */

        const scene =
            new THREE.Scene();



        /* ==============================
           CAMERA
        ================================ */

        const camera =
            new THREE.PerspectiveCamera(

                70,

                window.innerWidth /
                window.innerHeight,

                0.01,

                100

            );



        /* ==============================
           RENDERER
        ================================ */

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


        renderer.xr
            .setReferenceSpaceType(
                "local"
            );



        /* ==============================
           CHARGEMENT IMAGE
        ================================ */

        const textureLoader =
            new THREE.TextureLoader();


        const texture =
            await textureLoader
                .loadAsync(
                    selectedImage
                );


        texture.colorSpace =
            THREE.SRGBColorSpace;



        /* ==============================
           FORMAT IMAGE
        ================================ */

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



        /* ==============================
           GEOMETRIE
        ================================ */

        const geometry =
            new THREE.PlaneGeometry(

                planeWidth,

                planeHeight

            );



        /* ==============================
           MATERIAU
        ================================ */

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



        /* ==============================
           DESSIN
        ================================ */

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



        /* ==============================
           CONTROLEUR PICO
        ================================ */

        const controller =
            renderer.xr
                .getController(0);


        scene.add(
            controller
        );



        /* ==============================
           RAYON
        ================================ */

        const rayGeometry =
            new THREE
                .BufferGeometry()
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



        /* ==============================
           VARIABLES DEPLACEMENT
        ================================ */

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



        /* ==============================
           MODE INCLINAISON
        ================================ */

        let tiltMode =
            false;



        /* ==============================
           OPACITE
        ================================ */

        let opacityPlusPressed =
            false;


        let opacityMinusPressed =
            false;



        /* ==============================
           CALCUL RAYON
        ================================ */

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


            raycaster
                .ray
                .origin
                .copy(
                    rayOrigin
                );


            raycaster
                .ray
                .direction
                .copy(
                    rayDirection
                );

        }



        /* ==============================
           GACHETTE PRINCIPALE
           SAISIR IMAGE
        ================================ */

        controller.addEventListener(
            "selectstart",
            () => {

                updateControllerRay();


                const intersections =
                    raycaster
                        .intersectObject(
                            drawing,
                            false
                        );


                if (
                    intersections.length
                    === 0
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



        controller.addEventListener(
            "selectend",
            () => {

                isDragging =
                    false;

            }
        );



        /* ==============================
           GACHETTE ARRIERE / GRIP

           Maintenue =
           mode inclinaison 3D
        ================================ */

        controller.addEventListener(
            "squeezestart",
            () => {

                tiltMode =
                    true;


                console.log(
                    "Mode inclinaison activé"
                );

            }
        );


        controller.addEventListener(
            "squeezeend",
            () => {

                tiltMode =
                    false;


                console.log(
                    "Mode inclinaison désactivé"
                );

            }
        );



        /* ==============================
           ACTIVE SESSION THREE
        ================================ */

        await renderer.xr
            .setSession(
                session
            );



        /* ==============================
           BOUCLE XR
        ================================ */

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



                /* ======================
                   DEPLACEMENT
                ====================== */

                updateControllerRay();


                if (isDragging) {

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



                /* ======================
                   GAMEPAD
                ====================== */

                for (
                    const inputSource
                    of session.inputSources
                ) {

                    if (
                        inputSource
                            .targetRayMode
                        !==
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



                    /* ======================
                       MODE NORMAL
                    ====================== */

                    if (!tiltMode) {


                        /* ------------------
                           TAILLE
                        ------------------ */

                        if (
                            Math.abs(
                                stickY
                            )
                            >
                            deadZone
                        ) {

                            let scale =
                                drawing
                                    .scale
                                    .x;


                            scale +=

                                (-stickY)

                                * delta

                                * 0.8;


                            scale =
                                THREE.MathUtils
                                    .clamp(

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



                        /* ------------------
                           ROTATION A PLAT
                        ------------------ */

                        if (
                            Math.abs(
                                stickX
                            )
                            >
                            deadZone
                        ) {

                            drawing.rotation.z +=

                                (-stickX)

                                * delta

                                * 1.2;

                        }

                    }



                    /* ======================
                       MODE INCLINAISON 3D

                       Grip maintenu
                    ====================== */

                    if (tiltMode) {


                        /* ------------------
                           AVANT / ARRIERE

                           Angle du chevalet
                        ------------------ */

                        if (
                            Math.abs(
                                stickY
                            )
                            >
                            deadZone
                        ) {

                            drawing.rotation.x +=

                                (-stickY)

                                * delta

                                * 0.9;

                        }



                        /* ------------------
                           GAUCHE / DROITE

                           Si la toile est
                           également tournée
                           latéralement.
                        ------------------ */

                        if (
                            Math.abs(
                                stickX
                            )
                            >
                            deadZone
                        ) {

                            drawing.rotation.y +=

                                (-stickX)

                                * delta

                                * 0.9;

                        }



                        /*
                          Limites de sécurité.

                          +/- 75 degrés
                          maximum.
                        */

                        const maxTilt =
                            THREE.MathUtils
                                .degToRad(
                                    75
                                );


                        drawing.rotation.x =
                            THREE.MathUtils
                                .clamp(

                                    drawing.rotation.x,

                                    -maxTilt,

                                    maxTilt

                                );


                        drawing.rotation.y =
                            THREE.MathUtils
                                .clamp(

                                    drawing.rotation.y,

                                    -maxTilt,

                                    maxTilt

                                );

                    }



                    /* ======================
                       OPACITE
                    ====================== */

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
                                THREE.MathUtils
                                    .clamp(

                                        material.opacity,

                                        0.10,

                                        0.90

                                    );


                            console.log(

                                "Opacité :",

                                Math.round(

                                    material.opacity
                                    * 100

                                )
                                + "%"

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
                                THREE.MathUtils
                                    .clamp(

                                        material.opacity,

                                        0.10,

                                        0.90

                                    );


                            console.log(

                                "Opacité :",

                                Math.round(

                                    material.opacity
                                    * 100

                                )
                                + "%"

                            );

                        }


                        opacityMinusPressed =
                            minusNow;

                    }


                    break;

                }



                /* ======================
                   RENDU
                ====================== */

                renderer.render(

                    scene,

                    camera

                );

            }
        );



        /* ==============================
           FIN SESSION
        ================================ */

        session.addEventListener(
            "end",
            () => {

                renderer
                    .setAnimationLoop(
                        null
                    );


                geometry.dispose();

                material.dispose();

                texture.dispose();

                rayGeometry.dispose();

                rayMaterial.dispose();

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