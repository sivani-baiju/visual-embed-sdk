/**
 * Copyright (c) 2022
 *
 * Embed a ThoughtSpot Liveboard or visualization
 * https://developers.thoughtspot.com/docs/?pageid=embed-pinboard
 * https://developers.thoughtspot.com/docs/?pageid=embed-a-viz
 *
 * @summary Liveboard & visualization embed
 * @author Ayon Ghosh <ayon.ghosh@thoughtspot.com>
 */

import { ERROR_MESSAGE } from '../errors';
import {
    EmbedEvent,
    MessagePayload,
    Param,
    RuntimeFilter,
    DOMSelector,
    HostEvent,
    ViewConfig,
} from '../types';
import { getQueryParamString, isUndefined } from '../utils';
import { getAuthPromise } from './base';
import { V1Embed } from './ts-embed';

/**
 * The configuration for the embedded Liveboard or visualization page view.
 *
 * @group Embed components
 */
export interface LiveboardViewConfig extends Omit<ViewConfig, 'hiddenHomepageModules' | 'hiddenHomeLeftNavItems'| 'reorderedHomepageModules'> {
    /**
     * If set to true, the embedded object container dynamically resizes
     * according to the height of the Liveboard.
     *
     * @version SDK: 1.1.0 | ThoughtSpot: ts7.may.cl, 7.2.1
     */
    fullHeight?: boolean;
    /**
     * This is the minimum height(in pixels) for a full height Liveboard.
     * Setting this height helps resolves issues with empty Liveboards and
     * other screens navigable from a Liveboard.
     *
     * @version SDK: 1.5.0 | ThoughtSpot: ts7.oct.cl, 7.2.1
     * @default 500
     */
    defaultHeight?: number;
    /**
     * @Deprecated If set to true, the context menu in visualizations will be enabled.
     */
    enableVizTransformations?: boolean;
    /**
     * The Liveboard to display in the embedded view.
     * Use either of liveboardId or pinboardId to reference the Liveboard to embed.
     *
     * @version SDK: 1.3.0 | ThoughtSpot ts7.aug.cl, 7.2.1
     */
    liveboardId?: string;
    /**
     * To support backward compatibility
     *
     * @hidden
     */
    pinboardId?: string;
    /**
     * The visualization within the Liveboard to display.
     */
    vizId?: string;
    /**
     * If set to true, all filter chips from a
     * Liveboard page will be read-only (no X buttons)
     *
     * @version SDK: 1.3.0 | ThoughtSpot ts7.aug.cl, 7.2.1
     */
    preventLiveboardFilterRemoval?: boolean;
    /**
     * Array of viz ids which should be visible when the liveboard
     * first renders. This can be changed by triggering the "SetVisibleVizs"
     * event.
     *
     * @version SDK: 1.9.1 | ThoughtSpot: 8.1.0.cl, 8.4.1-sw
     */
    visibleVizs?: string[];
    /**
     * To support backward compatibilty
     *
     * @hidden
     */
    preventPinboardFilterRemoval?: boolean;
    /**
     * Render embedded Liveboards and visualizations in the new Liveboard experience mode
     *
     * @version SDK: 1.14.0 | ThoughtSpot: 8.6.0.cl, 8.8.1-sw
     */
    liveboardV2?: boolean;
    /**
     * Tab ID of the Liveboard that is supposed to be active
     *
     * @version SDK: 1.15.0 | ThoughtSpot: 8.7.0.cl, 8.8.1-sw
     */
    activeTabId?: string;
    /**
     * Hide tab Panel of embedded LB
     *
     * @version SDK: 1.25.0 | Thoughtspot: 9.6.0.cl
     */
    hideTabPanel?: boolean;
    /**
     * Show or hide Liveboard header
     *
     * @version SDK: 1.26.0 | Thoughtspot: 9.7.0.cl
     * @default false
     */
    hideLiveboardHeader?: boolean;
    /**
     * Show or hide Liveboard title
     *
     * @version SDK: 1.26.0 | Thoughtspot: 9.7.0.cl
     * @default false
     */
    showLiveboardTitle?: boolean;
    /**
     * Show or hide Liveboard description
     *
     * @version SDK: 1.26.0 | Thoughtspot: 9.7.0.cl
     * @default false
     */
    showLiveboardDescription?: boolean;
    /**
     * Boolean for sticky Liveboard header.
     *
     * @example
     * ```js
     * const embed = new LiveboardEmbed('#embed', {
     *   ... // other liveboard view config
     *   isLiveboardHeaderSticky: true,
     * });
     * ```
     * @version SDK: 1.26.0 | Thoughtspot: 9.7.0.cl
     */
    isLiveboardHeaderSticky?: boolean;
}

/**
 * Embed a ThoughtSpot Liveboard or a Thoughtspot visualization. When rendered it already
 * waits for the authentication to complete, so no need to wait for AuthStatus.SUCCESS.
 *
 * @example
 * ```js
 * import { .. } from '@thoughtspot/visual-embed-sdk';
 * init({ ... });
 * const embed = new LiveboardEmbed("#container", {
 *   liveboardId: <your-id-here>,
 * // .. other params here.
 * })
 * ```
 * @group Embed components
 */
export class LiveboardEmbed extends V1Embed {
    protected viewConfig: LiveboardViewConfig;

    private defaultHeight = 500;

    protected embedComponentType = 'LiveboardEmbed';

    // eslint-disable-next-line no-useless-constructor
    constructor(domSelector: DOMSelector, viewConfig: LiveboardViewConfig) {
        super(domSelector, viewConfig);
        if (this.viewConfig.fullHeight === true) {
            this.on(EmbedEvent.RouteChange, this.setIframeHeightForNonEmbedLiveboard);
            this.on(EmbedEvent.EmbedHeight, this.updateIFrameHeight);
            this.on(EmbedEvent.EmbedIframeCenter, this.embedIframeCenter);
        }
    }

    /**
     * Construct a map of params to be passed on to the
     * embedded Liveboard or visualization.
     */
    protected getEmbedParams() {
        let params = {};
        params[Param.EmbedApp] = true;
        params = this.getBaseQueryParams(params);
        const {
            enableVizTransformations,
            fullHeight,
            defaultHeight,
            visibleVizs,
            liveboardV2,
            vizId,
            hideTabPanel,
            activeTabId,
            hideLiveboardHeader,
            showLiveboardDescription,
            showLiveboardTitle,
            isLiveboardHeaderSticky = true,
        } = this.viewConfig;

        const preventLiveboardFilterRemoval = this.viewConfig.preventLiveboardFilterRemoval
            || this.viewConfig.preventPinboardFilterRemoval;

        if (fullHeight === true) {
            params[Param.fullHeight] = true;
        }
        if (defaultHeight) {
            this.defaultHeight = defaultHeight;
        }
        if (enableVizTransformations !== undefined) {
            params[Param.EnableVizTransformations] = enableVizTransformations.toString();
        }
        if (preventLiveboardFilterRemoval) {
            params[Param.preventLiveboardFilterRemoval] = true;
        }
        if (visibleVizs) {
            params[Param.visibleVizs] = visibleVizs;
        }
        params[Param.livedBoardEmbed] = true;
        if (vizId) {
            params[Param.vizEmbed] = true;
        }
        if (liveboardV2 !== undefined) {
            params[Param.LiveboardV2Enabled] = liveboardV2;
        }
        if (hideTabPanel) {
            params[Param.HideTabPanel] = hideTabPanel;
        }
        if (hideLiveboardHeader) {
            params[Param.HideLiveboardHeader] = hideLiveboardHeader;
        }
        if (showLiveboardDescription) {
            params[Param.ShowLiveboardDescription] = showLiveboardDescription;
        }
        if (showLiveboardTitle) {
            params[Param.ShowLiveboardTitle] = showLiveboardTitle;
        }

        params[Param.LiveboardHeaderSticky] = isLiveboardHeaderSticky;

        const queryParams = getQueryParamString(params, true);

        return queryParams;
    }

    private getIframeSuffixSrc(liveboardId: string, vizId: string, activeTabId: string) {
        let suffix = `/embed/viz/${liveboardId}`;
        if (activeTabId) {
            suffix = `${suffix}/tab/${activeTabId} `;
        }
        if (vizId) {
            suffix = `${suffix}/${vizId}`;
        }
        const tsPostHashParams = this.getThoughtSpotPostUrlParams();
        suffix = `${suffix}${tsPostHashParams}`;
        return suffix;
    }

    /**
     * Construct the URL of the embedded ThoughtSpot Liveboard or visualization
     * to be loaded within the iframe.
     */
    private getIFrameSrc() {
        const { vizId, activeTabId } = this.viewConfig;
        const liveboardId = this.viewConfig.liveboardId ?? this.viewConfig.pinboardId;

        if (!liveboardId) {
            this.handleError(ERROR_MESSAGE.LIVEBOARD_VIZ_ID_VALIDATION);
        }
        return `${this.getRootIframeSrc()}${this.getIframeSuffixSrc(
            liveboardId,
            vizId,
            activeTabId,
        )}`;
    }

    /**
     * Set the iframe height as per the computed height received
     * from the ThoughtSpot app.
     *
     * @param data The event payload
     */
    private updateIFrameHeight = (data: MessagePayload) => {
        this.setIFrameHeight(Math.max(data.data, this.defaultHeight));
    };

    private embedIframeCenter = (data: MessagePayload, responder: any) => {
        const obj = this.getIframeCenter();
        responder({ type: EmbedEvent.EmbedIframeCenter, data: obj });
    };

    private setIframeHeightForNonEmbedLiveboard = (data: MessagePayload) => {
        if (!data.data.currentPath.startsWith('/embed/viz/')) {
            this.setIFrameHeight(this.defaultHeight);
        }
    };

    private setActiveTab(data: { tabId: string }) {
        if (!this.viewConfig.vizId) {
            const prefixPath = this.iFrame.src.split('#/')[1].split('/tab')[0];
            const path = `${prefixPath}/tab/${data.tabId}`;
            super.trigger(HostEvent.Navigate, path);
        }
    }

    protected beforePrerenderVisible(): void {
        const embedObj = this.insertedDomEl?.[this.embedNodeKey] as LiveboardEmbed;

        if (isUndefined(embedObj)) return;

        const showDifferentLib = this.viewConfig.liveboardId
        && embedObj.viewConfig.liveboardId !== this.viewConfig.liveboardId;

        if (showDifferentLib) {
            const libId = this.viewConfig.liveboardId;
            this.navigateToLiveboard(libId);
        }
    }

    protected handleRenderForPrerender(): void {
        if (isUndefined(this.viewConfig.liveboardId)) {
            this.prerenderGeneric();
            return;
        }
        super.handleRenderForPrerender();
    }

    /**
     * Triggers an event to the embedded app
     *
     * @param messageType The event type
     * @param data The payload to send with the message
     */
    public trigger(messageType: HostEvent, data: any = {}): Promise<any> {
        const dataWithVizId = data;
        if (messageType === HostEvent.SetActiveTab) {
            this.setActiveTab(data);
            return Promise.resolve(null);
        }
        if (typeof dataWithVizId === 'object' && this.viewConfig.vizId) {
            dataWithVizId.vizId = this.viewConfig.vizId;
        }
        return super.trigger(messageType, dataWithVizId);
    }

    /**
     * Render an embedded ThoughtSpot Liveboard or visualization
     *
     * @param renderOptions An object specifying the Liveboard ID,
     * visualization ID and the runtime filters.
     */
    public render(): LiveboardEmbed {
        super.render();

        const src = this.getIFrameSrc();
        this.renderV1Embed(src);

        return this;
    }

    public navigateToLiveboard(liveboardId: string, vizId?: string, activeTabId?: string) {
        const path = this.getIframeSuffixSrc(liveboardId, vizId, activeTabId);
        this.viewConfig.liveboardId = liveboardId;
        this.viewConfig.activeTabId = activeTabId;
        this.viewConfig.vizId = vizId;
        if (this.isRendered) {
            this.trigger(HostEvent.Navigate, path.substring(1));
        } else if (this.viewConfig.preRenderId) {
            this.preRender(true);
        } else {
            this.render();
        }
    }
}

/**
 * @hidden
 */
export class PinboardEmbed extends LiveboardEmbed {}
