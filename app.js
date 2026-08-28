console.log("CJ Trace démarré");


/* ==============================
   ELEMENTS DE L'INTERFACE
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
   CHOISIR UNE IMAGE
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


        /*
          Libère l'ancienne image
          si on en choisit une autre.
        */

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
   BOUTON COMMENCER
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

            console.error(error);


            status.textContent =
                "Impossible de lancer le mode AR.";

        }

    }
);


/* ==============================
   SESSION WEBXR
================================ */

async function startARSession() {

    let session = null;


    try {

        /*
          IMPORTANT :

          requestSession doit rester
          directement lié au clic
          utilisateur.

          On ouvre donc la session AR
          avant de charger la texture.
        */

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
           SCENE THREE.JS
        ================================ */

        const scene =
            new THREE.Scene();


        /* ==============================
           CAMERA XR
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
           RENDERER TRANSPARENT
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


        renderer.xr.enabled = true;


        /*
          L'espace "local" permet
          au dessin de rester fixe
          dans la pièce lorsque
          tu bouges la tête.
        */

        renderer.xr
            .setReferenceSpaceType(
                "local"
            );


        /* ==============================
           CHARGEMENT DU DESSIN
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
           FORMAT ORIGINAL
        ================================ */

        const imageWidth =
            texture.image.width;

        const imageHeight =
            texture.image.height;


        const ratio =
            imageWidth /
            imageHeight;


        /*
          Hauteur de départ :
          environ 80 cm.
        */

        const planeHeight =
            0.8;


        const planeWidth =
            planeHeight *
            ratio;


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

                map: texture,

                transparent: true,

                /*
                  Opacité de départ :
                  40 %
                */

                opacity: 0.40,

                side:
                    THREE.DoubleSide

            });


        const drawing =
            new THREE.Mesh(

                geometry,
                material

            );


        /* ==============================
           POSITION DE DEPART
        ================================ */

        drawing.position.set(

            0,
            0,
            -1.5

        );


        scene.add(drawing);


        /* ==============================
           CONTROLEUR PICO
        ================================ */

        const controller =
            renderer.xr
                .getController(0);


        scene.add(controller);


        /* ==============================
           RAYON DE LA MANETTE
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

                color: 0xffffff

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
           OUTILS DE DEPLACEMENT
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
           ETAT DES BOUTONS OPACITE
        ================================ */

        let opacityPlusPressed =
            false;


        let opacityMinusPressed =
            false;


        /* ==============================
           CALCUL DU RAYON
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
           GACHETTE : SAISIR
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


                /*
                  On ne saisit l'image
                  que si on la vise.
                */

                if (
                    intersections.length
                    === 0
                ) {

                    return;

                }


                isDragging =
                    true;


                /*
                  Distance entre la
                  manette et le dessin.
                */

                grabDistance =
                    intersections[0]
                        .distance;


                /*
                  Conserve le point exact
                  où l'image a été saisie.
                */

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


        /* ==============================
           RELACHER LE DESSIN
        ================================ */

        controller.addEventListener(
            "selectend",
            () => {

                isDragging =
                    false;

            }
        );


        /* ==============================
           DEMARRAGE SESSION THREE.JS
        ================================ */

        await renderer.xr
            .setSession(
                session
            );


        /* ==============================
           BOUCLE DE RENDU XR
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
                        ) / 1000,

                        0.1

                    );


                previousTime =
                    now;


                /* ==========================
                   DEPLACEMENT
                ========================== */

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


                /* ==========================
                   CONTROLES GAMEPAD
                ========================== */

                for (
                    const inputSource
                    of session.inputSources
                ) {

                    /*
                      On utilise seulement
                      les vraies manettes.
                    */

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


                    /*
                      Le dernier couple
                      d'axes correspond
                      généralement au stick
                      XR standard.
                    */

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
                       TAILLE
                       Stick haut / bas
                    ====================== */

                    if (
                        Math.abs(
                            stickY
                        ) >
                        deadZone
                    ) {

                        let scale =
                            drawing
                                .scale
                                .x;


                        /*
                          Haut :
                          agrandir.

                          Bas :
                          réduire.
                        */

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


                    /* ======================
                       ROTATION
                       Stick gauche / droite
                    ====================== */

                    if (
                        Math.abs(
                            stickX
                        ) >
                        deadZone
                    ) {

                        /*
                          Rotation uniquement
                          dans le plan de
                          l'image.

                          Elle reste donc
                          parallèle à la toile.
                        */

                        drawing.rotation.z +=

                            (-stickX)

                            * delta

                            * 1.2;

                    }


                    /* ======================
                       OPACITE
                    ====================== */

                    const buttons =
                        gamepad.buttons;


                    if (buttons) {

                        /*
                          Dans le mapping
                          XR standard :

                          bouton 4 =
                          bouton principal

                          bouton 5 =
                          second bouton.

                          On évite 0 et 1,
                          souvent utilisés
                          par gâchette / grip.
                        */

                        const plusButton =
                            buttons[4];


                        const minusButton =
                            buttons[5];


                        /* ------------------
                           PLUS D'OPACITE
                        ------------------ */

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
                                ) + "%"

                            );

                        }


                        opacityPlusPressed =
                            plusNow;


                        /* ------------------
                           MOINS D'OPACITE
                        ------------------ */

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
                                ) + "%"

                            );

                        }


                        opacityMinusPressed =
                            minusNow;

                    }


                    /*
                      Pour l'instant,
                      on utilise une seule
                      manette pour les
                      commandes du dessin.
                    */

                    break;

                }


                /* ==========================
                   AFFICHAGE
                ========================== */

                renderer.render(

                    scene,
                    camera

                );

            }
        );


        /* ==============================
           FIN DE SESSION
        ================================ */

        session.addEventListener(
            "end",
            () => {

                renderer
                    .setAnimationLoop(
                        null
                    );


                /*
                  Nettoyage THREE.JS
                */

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