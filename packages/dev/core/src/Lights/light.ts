import { serialize, serializeAsColor3, expandToProperty } from "../Misc/decorators";
import type { Nullable } from "../types";
import type { Scene } from "../scene";
import type { Matrix } from "../Maths/math.vector";
import { Vector3 } from "../Maths/math.vector";
import { Color3, TmpColors } from "../Maths/math.color";
import { Node } from "../node";
import type { AbstractMesh } from "../Meshes/abstractMesh";
import type { Effect } from "../Materials/effect";
import { UniformBuffer } from "../Materials/uniformBuffer";
import type { IShadowGenerator } from "./Shadows/shadowGenerator";
import { GetClass } from "../Misc/typeStore";
import type { ISortableLight } from "./lightConstants";
import { LightConstants } from "./lightConstants";
import type { Camera } from "../Cameras/camera";
import { SerializationHelper } from "../Misc/decorators.serialization";
/**
 * Base class of all the lights in Babylon. It groups all the generic information about lights.
 * Lights are used, as you would expect, to affect how meshes are seen, in terms of both illumination and colour.
 * All meshes allow light to pass through them unless shadow generation is activated. The default number of lights allowed is four but this can be increased.
 */
export abstract class Light extends Node implements ISortableLight {
    /**
     * Falloff Default: light is falling off following the material specification:
     * standard material is using standard falloff whereas pbr material can request special falloff per materials.
     */
    public static readonly FALLOFF_DEFAULT = LightConstants.FALLOFF_DEFAULT;

    /**
     * Falloff Physical: light is falling off following the inverse squared distance law.
     */
    public static readonly FALLOFF_PHYSICAL = LightConstants.FALLOFF_PHYSICAL;

    /**
     * Falloff gltf: light is falling off as described in the gltf moving to PBR document
     * to enhance interoperability with other engines.
     */
    public static readonly FALLOFF_GLTF = LightConstants.FALLOFF_GLTF;

    /**
     * Falloff Standard: light is falling off like in the standard material
     * to enhance interoperability with other materials.
     */
    public static readonly FALLOFF_STANDARD = LightConstants.FALLOFF_STANDARD;

    //lightmapMode Consts
    /**
     * If every light affecting the material is in this lightmapMode,
     * material.lightmapTexture adds or multiplies
     * (depends on material.useLightmapAsShadowmap)
     * after every other light calculations.
     */
    public static readonly LIGHTMAP_DEFAULT = LightConstants.LIGHTMAP_DEFAULT;
    /**
     * material.lightmapTexture as only diffuse lighting from this light
     * adds only specular lighting from this light
     * adds dynamic shadows
     */
    public static readonly LIGHTMAP_SPECULAR = LightConstants.LIGHTMAP_SPECULAR;
    /**
     * material.lightmapTexture as only lighting
     * no light calculation from this light
     * only adds dynamic shadows from this light
     */
    public static readonly LIGHTMAP_SHADOWSONLY = LightConstants.LIGHTMAP_SHADOWSONLY;

    // Intensity Mode Consts
    /**
     * Each light type uses the default quantity according to its type:
     *      point/spot lights use luminous intensity
     *      directional lights use illuminance
     */
    public static readonly INTENSITYMODE_AUTOMATIC = LightConstants.INTENSITYMODE_AUTOMATIC;
    /**
     * lumen (lm)
     */
    public static readonly INTENSITYMODE_LUMINOUSPOWER = LightConstants.INTENSITYMODE_LUMINOUSPOWER;
    /**
     * candela (lm/sr)
     */
    public static readonly INTENSITYMODE_LUMINOUSINTENSITY = LightConstants.INTENSITYMODE_LUMINOUSINTENSITY;
    /**
     * lux (lm/m^2)
     */
    public static readonly INTENSITYMODE_ILLUMINANCE = LightConstants.INTENSITYMODE_ILLUMINANCE;
    /**
     * nit (cd/m^2)
     */
    public static readonly INTENSITYMODE_LUMINANCE = LightConstants.INTENSITYMODE_LUMINANCE;

    // Light types ids const.
    /**
     * Light type const id of the point light.
     */
    public static readonly LIGHTTYPEID_POINTLIGHT = LightConstants.LIGHTTYPEID_POINTLIGHT;
    /**
     * Light type const id of the directional light.
     */
    public static readonly LIGHTTYPEID_DIRECTIONALLIGHT = LightConstants.LIGHTTYPEID_DIRECTIONALLIGHT;
    /**
     * Light type const id of the spot light.
     */
    public static readonly LIGHTTYPEID_SPOTLIGHT = LightConstants.LIGHTTYPEID_SPOTLIGHT;
    /**
     * Light type const id of the hemispheric light.
     */
    public static readonly LIGHTTYPEID_HEMISPHERICLIGHT = LightConstants.LIGHTTYPEID_HEMISPHERICLIGHT;

    /**
     * Light type const id of the area light.
     */
    public static readonly LIGHTTYPEID_RECT_AREALIGHT = LightConstants.LIGHTTYPEID_RECT_AREALIGHT;

    /**
     * Diffuse gives the basic color to an object.
     */
    @serializeAsColor3()
    public diffuse = new Color3(1.0, 1.0, 1.0);

    /**
     * Specular produces a highlight color on an object.
     * Note: This is not affecting PBR materials.
     */
    @serializeAsColor3()
    public specular = new Color3(1.0, 1.0, 1.0);

    /**
     * Defines the falloff type for this light. This lets overriding how punctual light are
     * falling off base on range or angle.
     * This can be set to any values in Light.FALLOFF_x.
     *
     * Note: This is only useful for PBR Materials at the moment. This could be extended if required to
     * other types of materials.
     */
    @serialize()
    public falloffType = Light.FALLOFF_DEFAULT;

    /**
     * Strength of the light.
     * Note: By default it is define in the framework own unit.
     * Note: In PBR materials the intensityMode can be use to chose what unit the intensity is defined in.
     */
    @serialize()
    public intensity = 1.0;

    private _range = Number.MAX_VALUE;
    protected _inverseSquaredRange = 0;

    /**
     * Defines how far from the source the light is impacting in scene units.
     * Note: Unused in PBR material as the distance light falloff is defined following the inverse squared falloff.
     */
    @serialize()
    public get range(): number {
        return this._range;
    }
    /**
     * Defines how far from the source the light is impacting in scene units.
     * Note: Unused in PBR material as the distance light falloff is defined following the inverse squared falloff.
     */
    public set range(value: number) {
        this._range = value;
        this._inverseSquaredRange = 1.0 / (this.range * this.range);
    }

    /**
     * Cached photometric scale default to 1.0 as the automatic intensity mode defaults to 1.0 for every type
     * of light.
     */
    private _photometricScale = 1.0;

    private _intensityMode: number = Light.INTENSITYMODE_AUTOMATIC;
    /**
     * Gets the photometric scale used to interpret the intensity.
     * This is only relevant with PBR Materials where the light intensity can be defined in a physical way.
     */
    @serialize()
    public get intensityMode(): number {
        return this._intensityMode;
    }
    /**
     * Sets the photometric scale used to interpret the intensity.
     * This is only relevant with PBR Materials where the light intensity can be defined in a physical way.
     */
    public set intensityMode(value: number) {
        this._intensityMode = value;
        this._computePhotometricScale();
    }

    private _radius = 0.00001;
    /**
     * Gets the light radius used by PBR Materials to simulate soft area lights.
     */
    @serialize()
    public get radius(): number {
        return this._radius;
    }
    /**
     * sets the light radius used by PBR Materials to simulate soft area lights.
     */
    public set radius(value: number) {
        this._radius = value;
        this._computePhotometricScale();
    }

    @serialize()
    private _renderPriority: number;
    /**
     * Defines the rendering priority of the lights. It can help in case of fallback or number of lights
     * exceeding the number allowed of the materials.
     */
    @expandToProperty("_reorderLightsInScene")
    public renderPriority: number = 0;

    @serialize("shadowEnabled")
    private _shadowEnabled: boolean = true;
    /**
     * Gets whether or not the shadows are enabled for this light. This can help turning off/on shadow without detaching
     * the current shadow generator.
     */
    public get shadowEnabled(): boolean {
        return this._shadowEnabled;
    }
    /**
     * Sets whether or not the shadows are enabled for this light. This can help turning off/on shadow without detaching
     * the current shadow generator.
     */
    public set shadowEnabled(value: boolean) {
        if (this._shadowEnabled === value) {
            return;
        }

        this._shadowEnabled = value;
        this._markMeshesAsLightDirty();
    }

    private _includedOnlyMeshes: AbstractMesh[];
    /**
     * Gets the only meshes impacted by this light.
     */
    public get includedOnlyMeshes(): AbstractMesh[] {
        return this._includedOnlyMeshes;
    }
    /**
     * Sets the only meshes impacted by this light.
     */
    public set includedOnlyMeshes(value: AbstractMesh[]) {
        this._includedOnlyMeshes = value;
        this._hookArrayForIncludedOnly(value);
    }

    private _excludedMeshes: AbstractMesh[];
    /**
     * Gets the meshes not impacted by this light.
     */
    public get excludedMeshes(): AbstractMesh[] {
        return this._excludedMeshes;
    }
    /**
     * Sets the meshes not impacted by this light.
     */
    public set excludedMeshes(value: AbstractMesh[]) {
        this._excludedMeshes = value;
        this._hookArrayForExcluded(value);
    }

    @serialize("excludeWithLayerMask")
    private _excludeWithLayerMask = 0;
    /**
     * Gets the layer id use to find what meshes are not impacted by the light.
     * Inactive if 0
     */
    public get excludeWithLayerMask(): number {
        return this._excludeWithLayerMask;
    }
    /**
     * Sets the layer id use to find what meshes are not impacted by the light.
     * Inactive if 0
     */
    public set excludeWithLayerMask(value: number) {
        this._excludeWithLayerMask = value;
        this._resyncMeshes();
    }

    @serialize("includeOnlyWithLayerMask")
    private _includeOnlyWithLayerMask = 0;
    /**
     * Gets the layer id use to find what meshes are impacted by the light.
     * Inactive if 0
     */
    public get includeOnlyWithLayerMask(): number {
        return this._includeOnlyWithLayerMask;
    }
    /**
     * Sets the layer id use to find what meshes are impacted by the light.
     * Inactive if 0
     */
    public set includeOnlyWithLayerMask(value: number) {
        this._includeOnlyWithLayerMask = value;
        this._resyncMeshes();
    }

    @serialize("lightmapMode")
    private _lightmapMode = 0;
    /**
     * Gets the lightmap mode of this light (should be one of the constants defined by Light.LIGHTMAP_x)
     */
    public get lightmapMode(): number {
        return this._lightmapMode;
    }
    /**
     * Sets the lightmap mode of this light (should be one of the constants defined by Light.LIGHTMAP_x)
     */
    public set lightmapMode(value: number) {
        if (this._lightmapMode === value) {
            return;
        }

        this._lightmapMode = value;
        this._markMeshesAsLightDirty();
    }

    /**
     * Returns the view matrix.
     * @param _faceIndex The index of the face for which we want to extract the view matrix. Only used for point light types.
     * @returns The view matrix. Can be null, if a view matrix cannot be defined for the type of light considered (as for a hemispherical light, for example).
     */
    public getViewMatrix(_faceIndex?: number): Nullable<Matrix> {
        return null;
    }

    /**
     * Returns the projection matrix.
     * Note that viewMatrix and renderList are optional and are only used by lights that calculate the projection matrix from a list of meshes (e.g. directional lights with automatic extents calculation).
     * @param _viewMatrix The view transform matrix of the light (optional).
     * @param _renderList The list of meshes to take into account when calculating the projection matrix (optional).
     * @returns The projection matrix. Can be null, if a projection matrix cannot be defined for the type of light considered (as for a hemispherical light, for example).
     */
    public getProjectionMatrix(_viewMatrix?: Matrix, _renderList?: Array<AbstractMesh>): Nullable<Matrix> {
        return null;
    }

    /**
     * Shadow generators associated to the light.
     * @internal Internal use only.
     */
    public _shadowGenerators: Nullable<Map<Nullable<Camera>, IShadowGenerator>> = null;

    /**
     * @internal Internal use only.
     */
    public _excludedMeshesIds = new Array<string>();

    /**
     * @internal Internal use only.
     */
    public _includedOnlyMeshesIds = new Array<string>();

    /**
     * The current light uniform buffer.
     * @internal Internal use only.
     */
    public _uniformBuffer: UniformBuffer;

    /** @internal */
    public _renderId: number;

    private _lastUseSpecular: boolean;

    /**
     * Creates a Light object in the scene.
     * Documentation : https://doc.babylonjs.com/features/featuresDeepDive/lights/lights_introduction
     * @param name The friendly name of the light
     * @param scene The scene the light belongs too
     */
    constructor(name: string, scene?: Scene) {
        super(name, scene, false);
        this.getScene().addLight(this);
        this._uniformBuffer = new UniformBuffer(this.getScene().getEngine(), undefined, undefined, name);
        this._buildUniformLayout();

        this.includedOnlyMeshes = [] as AbstractMesh[];
        this.excludedMeshes = [] as AbstractMesh[];

        this._resyncMeshes();
    }

    protected abstract _buildUniformLayout(): void;

    /**
     * Sets the passed Effect "effect" with the Light information.
     * @param effect The effect to update
     * @param lightIndex The index of the light in the effect to update
     * @returns The light
     */
    public abstract transferToEffect(effect: Effect, lightIndex: string): Light;

    /**
     * Sets the passed Effect "effect" with the Light textures.
     * @param effect The effect to update
     * @param lightIndex The index of the light in the effect to update
     * @returns The light
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public transferTexturesToEffect(effect: Effect, lightIndex: string): Light {
        // Do nothing by default.
        return this;
    }

    /**
     * Binds the lights information from the scene to the effect for the given mesh.
     * @param lightIndex Light index
     * @param scene The scene where the light belongs to
     * @param effect The effect we are binding the data to
     * @param useSpecular Defines if specular is supported
     * @param receiveShadows Defines if the effect (mesh) we bind the light for receives shadows
     */
    public _bindLight(lightIndex: number, scene: Scene, effect: Effect, useSpecular: boolean, receiveShadows = true): void {
        const iAsString = lightIndex.toString();
        let needUpdate = false;

        this._uniformBuffer.bindToEffect(effect, "Light" + iAsString);

        if (this._renderId !== scene.getRenderId() || this._lastUseSpecular !== useSpecular || !this._uniformBuffer.useUbo) {
            this._renderId = scene.getRenderId();
            this._lastUseSpecular = useSpecular;

            const scaledIntensity = this.getScaledIntensity();

            this.transferToEffect(effect, iAsString);

            this.diffuse.scaleToRef(scaledIntensity, TmpColors.Color3[0]);
            this._uniformBuffer.updateColor4("vLightDiffuse", TmpColors.Color3[0], this.range, iAsString);
            if (useSpecular) {
                this.specular.scaleToRef(scaledIntensity, TmpColors.Color3[1]);
                this._uniformBuffer.updateColor4("vLightSpecular", TmpColors.Color3[1], this.radius, iAsString);
            }
            needUpdate = true;
        }

        // Textures might still need to be rebound.
        this.transferTexturesToEffect(effect, iAsString);

        // Shadows
        if (scene.shadowsEnabled && this.shadowEnabled && receiveShadows) {
            const shadowGenerator = this.getShadowGenerator(scene.activeCamera) ?? this.getShadowGenerator();
            if (shadowGenerator) {
                shadowGenerator.bindShadowLight(iAsString, effect);
                needUpdate = true;
            }
        }

        if (needUpdate) {
            this._uniformBuffer.update();
        } else {
            this._uniformBuffer.bindUniformBuffer();
        }
    }

    /**
     * Sets the passed Effect "effect" with the Light information.
     * @param effect The effect to update
     * @param lightDataUniformName The uniform used to store light data (position or direction)
     * @returns The light
     */
    public abstract transferToNodeMaterialEffect(effect: Effect, lightDataUniformName: string): Light;

    /**
     * Returns the string "Light".
     * @returns the class name
     */
    public override getClassName(): string {
        return "Light";
    }

    /** @internal */
    public readonly _isLight = true;

    /**
     * Converts the light information to a readable string for debug purpose.
     * @param fullDetails Supports for multiple levels of logging within scene loading
     * @returns the human readable light info
     */
    public override toString(fullDetails?: boolean): string {
        let ret = "Name: " + this.name;
        ret += ", type: " + ["Point", "Directional", "Spot", "Hemispheric"][this.getTypeID()];
        if (this.animations) {
            for (let i = 0; i < this.animations.length; i++) {
                ret += ", animation[0]: " + this.animations[i].toString(fullDetails);
            }
        }
        return ret;
    }

    /** @internal */
    protected override _syncParentEnabledState() {
        super._syncParentEnabledState();
        if (!this.isDisposed()) {
            this._resyncMeshes();
        }
    }

    /**
     * Set the enabled state of this node.
     * @param value - the new enabled state
     */
    public override setEnabled(value: boolean): void {
        super.setEnabled(value);

        this._resyncMeshes();
    }

    /**
     * Returns the Light associated shadow generator if any.
     * @param camera Camera for which the shadow generator should be retrieved (default: null). If null, retrieves the default shadow generator
     * @returns the associated shadow generator.
     */
    public getShadowGenerator(camera: Nullable<Camera> = null): Nullable<IShadowGenerator> {
        if (this._shadowGenerators === null) {
            return null;
        }

        return this._shadowGenerators.get(camera) ?? null;
    }

    /**
     * Returns all the shadow generators associated to this light
     * @returns
     */
    public getShadowGenerators(): Nullable<Map<Nullable<Camera>, IShadowGenerator>> {
        return this._shadowGenerators;
    }

    /**
     * Returns a Vector3, the absolute light position in the World.
     * @returns the world space position of the light
     */
    public getAbsolutePosition(): Vector3 {
        return Vector3.Zero();
    }

    /**
     * Specifies if the light will affect the passed mesh.
     * @param mesh The mesh to test against the light
     * @returns true the mesh is affected otherwise, false.
     */
    public canAffectMesh(mesh: AbstractMesh): boolean {
        if (!mesh) {
            return true;
        }

        if (this.includedOnlyMeshes && this.includedOnlyMeshes.length > 0 && this.includedOnlyMeshes.indexOf(mesh) === -1) {
            return false;
        }

        if (this.excludedMeshes && this.excludedMeshes.length > 0 && this.excludedMeshes.indexOf(mesh) !== -1) {
            return false;
        }

        if (this.includeOnlyWithLayerMask !== 0 && (this.includeOnlyWithLayerMask & mesh.layerMask) === 0) {
            return false;
        }

        if (this.excludeWithLayerMask !== 0 && this.excludeWithLayerMask & mesh.layerMask) {
            return false;
        }

        return true;
    }

    /**
     * Releases resources associated with this node.
     * @param doNotRecurse Set to true to not recurse into each children (recurse into each children by default)
     * @param disposeMaterialAndTextures Set to true to also dispose referenced materials and textures (false by default)
     */
    public override dispose(doNotRecurse?: boolean, disposeMaterialAndTextures = false): void {
        if (this._shadowGenerators) {
            const iterator = this._shadowGenerators.values();
            for (let key = iterator.next(); key.done !== true; key = iterator.next()) {
                const shadowGenerator = key.value;
                shadowGenerator.dispose();
            }
            this._shadowGenerators = null;
        }

        // Animations
        this.getScene().stopAnimation(this);

        if (this._parentContainer) {
            const index = this._parentContainer.lights.indexOf(this);
            if (index > -1) {
                this._parentContainer.lights.splice(index, 1);
            }
            this._parentContainer = null;
        }

        // Remove from meshes
        for (const mesh of this.getScene().meshes) {
            mesh._removeLightSource(this, true);
        }

        this._uniformBuffer.dispose();

        // Remove from scene
        this.getScene().removeLight(this);
        super.dispose(doNotRecurse, disposeMaterialAndTextures);
    }

    /**
     * Returns the light type ID (integer).
     * @returns The light Type id as a constant defines in Light.LIGHTTYPEID_x
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public getTypeID(): number {
        return 0;
    }

    /**
     * Returns the intensity scaled by the Photometric Scale according to the light type and intensity mode.
     * @returns the scaled intensity in intensity mode unit
     */
    public getScaledIntensity() {
        return this._photometricScale * this.intensity;
    }

    /**
     * Returns a new Light object, named "name", from the current one.
     * @param name The name of the cloned light
     * @param newParent The parent of this light, if it has one
     * @returns the new created light
     */
    public override clone(name: string, newParent: Nullable<Node> = null): Nullable<Light> {
        const constructor = Light.GetConstructorFromName(this.getTypeID(), name, this.getScene());

        if (!constructor) {
            return null;
        }
        const clonedLight = SerializationHelper.Clone(constructor, this);
        if (name) {
            clonedLight.name = name;
        }
        if (newParent) {
            clonedLight.parent = newParent;
        }
        clonedLight.setEnabled(this.isEnabled());

        this.onClonedObservable.notifyObservers(clonedLight);

        return clonedLight;
    }

    /**
     * Serializes the current light into a Serialization object.
     * @returns the serialized object.
     */
    public serialize(): any {
        const serializationObject = SerializationHelper.Serialize(this);
        serializationObject.uniqueId = this.uniqueId;

        // Type
        serializationObject.type = this.getTypeID();

        // Parent
        if (this.parent) {
            this.parent._serializeAsParent(serializationObject);
        }

        // Inclusion / exclusions
        if (this.excludedMeshes.length > 0) {
            serializationObject.excludedMeshesIds = [];
            for (const mesh of this.excludedMeshes) {
                serializationObject.excludedMeshesIds.push(mesh.id);
            }
        }

        if (this.includedOnlyMeshes.length > 0) {
            serializationObject.includedOnlyMeshesIds = [];
            for (const mesh of this.includedOnlyMeshes) {
                serializationObject.includedOnlyMeshesIds.push(mesh.id);
            }
        }

        // Animations
        SerializationHelper.AppendSerializedAnimations(this, serializationObject);
        serializationObject.ranges = this.serializeAnimationRanges();

        serializationObject.isEnabled = this.isEnabled();

        return serializationObject;
    }

    /**
     * Creates a new typed light from the passed type (integer) : point light = 0, directional light = 1, spot light = 2, hemispheric light = 3.
     * This new light is named "name" and added to the passed scene.
     * @param type Type according to the types available in Light.LIGHTTYPEID_x
     * @param name The friendly name of the light
     * @param scene The scene the new light will belong to
     * @returns the constructor function
     */
    static GetConstructorFromName(type: number, name: string, scene: Scene): Nullable<() => Light> {
        const constructorFunc = Node.Construct("Light_Type_" + type, name, scene);

        if (constructorFunc) {
            return <() => Light>constructorFunc;
        }

        // Default to no light for none present once.
        return null;
    }

    /**
     * Parses the passed "parsedLight" and returns a new instanced Light from this parsing.
     * @param parsedLight The JSON representation of the light
     * @param scene The scene to create the parsed light in
     * @returns the created light after parsing
     */
    public static Parse(parsedLight: any, scene: Scene): Nullable<Light> {
        const constructor = Light.GetConstructorFromName(parsedLight.type, parsedLight.name, scene);

        if (!constructor) {
            return null;
        }

        const light = SerializationHelper.Parse(constructor, parsedLight, scene);

        // Inclusion / exclusions
        if (parsedLight.excludedMeshesIds) {
            light._excludedMeshesIds = parsedLight.excludedMeshesIds;
        }

        if (parsedLight.includedOnlyMeshesIds) {
            light._includedOnlyMeshesIds = parsedLight.includedOnlyMeshesIds;
        }

        // Parent
        if (parsedLight.parentId !== undefined) {
            light._waitingParentId = parsedLight.parentId;
        }

        if (parsedLight.parentInstanceIndex !== undefined) {
            light._waitingParentInstanceIndex = parsedLight.parentInstanceIndex;
        }

        // Falloff
        if (parsedLight.falloffType !== undefined) {
            light.falloffType = parsedLight.falloffType;
        }

        // Lightmaps
        if (parsedLight.lightmapMode !== undefined) {
            light.lightmapMode = parsedLight.lightmapMode;
        }

        // Animations
        if (parsedLight.animations) {
            for (let animationIndex = 0; animationIndex < parsedLight.animations.length; animationIndex++) {
                const parsedAnimation = parsedLight.animations[animationIndex];
                const internalClass = GetClass("BABYLON.Animation");
                if (internalClass) {
                    light.animations.push(internalClass.Parse(parsedAnimation));
                }
            }
            Node.ParseAnimationRanges(light, parsedLight, scene);
        }

        if (parsedLight.autoAnimate) {
            scene.beginAnimation(light, parsedLight.autoAnimateFrom, parsedLight.autoAnimateTo, parsedLight.autoAnimateLoop, parsedLight.autoAnimateSpeed || 1.0);
        }

        // Check if isEnabled is defined to be back compatible with prior serialized versions.
        if (parsedLight.isEnabled !== undefined) {
            light.setEnabled(parsedLight.isEnabled);
        }

        return light;
    }

    private _hookArrayForExcluded(array: AbstractMesh[]): void {
        const oldPush = array.push;
        array.push = (...items: AbstractMesh[]) => {
            const result = oldPush.apply(array, items);

            for (const item of items) {
                item._resyncLightSource(this);
            }

            return result;
        };

        const oldSplice = array.splice;
        array.splice = (index: number, deleteCount?: number) => {
            const deleted = oldSplice.apply(array, [index, deleteCount]);

            for (const item of deleted) {
                item._resyncLightSource(this);
            }

            return deleted;
        };

        for (const item of array) {
            item._resyncLightSource(this);
        }
    }

    private _hookArrayForIncludedOnly(array: AbstractMesh[]): void {
        const oldPush = array.push;
        array.push = (...items: AbstractMesh[]) => {
            const result = oldPush.apply(array, items);

            this._resyncMeshes();

            return result;
        };

        const oldSplice = array.splice;
        array.splice = (index: number, deleteCount?: number) => {
            const deleted = oldSplice.apply(array, [index, deleteCount]);

            this._resyncMeshes();

            return deleted;
        };

        this._resyncMeshes();
    }

    private _resyncMeshes() {
        for (const mesh of this.getScene().meshes) {
            mesh._resyncLightSource(this);
        }
    }

    /**
     * Forces the meshes to update their light related information in their rendering used effects
     * @internal Internal Use Only
     */
    public _markMeshesAsLightDirty() {
        for (const mesh of this.getScene().meshes) {
            if (mesh.lightSources.indexOf(this) !== -1) {
                mesh._markSubMeshesAsLightDirty();
            }
        }
    }

    /**
     * Recomputes the cached photometric scale if needed.
     */
    private _computePhotometricScale(): void {
        this._photometricScale = this._getPhotometricScale();
        this.getScene().resetCachedMaterial();
    }

    /**
     * @returns the Photometric Scale according to the light type and intensity mode.
     */
    private _getPhotometricScale() {
        let photometricScale = 0.0;
        const lightTypeID = this.getTypeID();

        //get photometric mode
        let photometricMode = this.intensityMode;
        if (photometricMode === Light.INTENSITYMODE_AUTOMATIC) {
            if (lightTypeID === Light.LIGHTTYPEID_DIRECTIONALLIGHT) {
                photometricMode = Light.INTENSITYMODE_ILLUMINANCE;
            } else {
                photometricMode = Light.INTENSITYMODE_LUMINOUSINTENSITY;
            }
        }

        //compute photometric scale
        switch (lightTypeID) {
            case Light.LIGHTTYPEID_POINTLIGHT:
            case Light.LIGHTTYPEID_SPOTLIGHT:
                switch (photometricMode) {
                    case Light.INTENSITYMODE_LUMINOUSPOWER:
                        photometricScale = 1.0 / (4.0 * Math.PI);
                        break;
                    case Light.INTENSITYMODE_LUMINOUSINTENSITY:
                        photometricScale = 1.0;
                        break;
                    case Light.INTENSITYMODE_LUMINANCE:
                        photometricScale = this.radius * this.radius;
                        break;
                }
                break;

            case Light.LIGHTTYPEID_DIRECTIONALLIGHT:
                switch (photometricMode) {
                    case Light.INTENSITYMODE_ILLUMINANCE:
                        photometricScale = 1.0;
                        break;
                    case Light.INTENSITYMODE_LUMINANCE: {
                        // When radius (and therefore solid angle) is non-zero a directional lights brightness can be specified via central (peak) luminance.
                        // For a directional light the 'radius' defines the angular radius (in radians) rather than world-space radius (e.g. in metres).
                        let apexAngleRadians = this.radius;
                        // Impose a minimum light angular size to avoid the light becoming an infinitely small angular light source (i.e. a dirac delta function).
                        apexAngleRadians = Math.max(apexAngleRadians, 0.001);
                        const solidAngle = 2.0 * Math.PI * (1.0 - Math.cos(apexAngleRadians));
                        photometricScale = solidAngle;
                        break;
                    }
                }
                break;

            case Light.LIGHTTYPEID_HEMISPHERICLIGHT:
                // No fall off in hemispheric light.
                photometricScale = 1.0;
                break;
        }
        return photometricScale;
    }

    /**
     * Reorder the light in the scene according to their defined priority.
     * @internal Internal Use Only
     */
    public _reorderLightsInScene(): void {
        const scene = this.getScene();
        if (this._renderPriority != 0) {
            scene.requireLightSorting = true;
        }
        this.getScene().sortLightsByPriority();
    }

    /**
     * Prepares the list of defines specific to the light type.
     * @param defines the list of defines
     * @param lightIndex defines the index of the light for the effect
     */
    public abstract prepareLightSpecificDefines(defines: any, lightIndex: number): void;

    /**
     * @internal
     */
    public _isReady() {
        return true;
    }
}
