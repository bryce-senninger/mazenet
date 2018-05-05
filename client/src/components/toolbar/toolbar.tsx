
// Handles popping up tools and such.
import * as React from 'react';

import './toolbar.css';
import { SocketAPI } from '../../services/SocketAPI';
import TunnelTool from './tunnelTool';
import { Models } from '../../../../common/api/v1';
import TextTool from './textTool';
import HomeTool from './homeTool';
import ConfigTool from './configTool';
import StyleTool from './styleTool';
import { InfoTool } from './infoTool';
import { UserTool } from './userTool';

interface ToolbarState {
    room: Models.Room | null;
    rootRoomId: string;
    user: Models.ActiveUser | null;
}

export default class Toolbar extends React.PureComponent<any, ToolbarState> {

    private tunnelTool: TunnelTool | null;
    private textTool: TextTool | null;
    private configTool: ConfigTool | null;
    private homeTool: HomeTool | null;
    private styleTool: StyleTool | null;

    constructor(props: any) {
        super(props);
        this.state = {
            room: null,
            rootRoomId: '',
            user: null
        };
        SocketAPI.Instance.connectedObservable.subscribe(value => {
            this.setState({
                rootRoomId: value.rootRoomId,
                user: value.activeUser
            });
        });
        SocketAPI.Instance.roomEnteredObservable.subscribe((value => {
            this.setState({
                room: value.room
            });
        }));

        if (Math.min(0, 1) === 3) {
            document.body.addEventListener('keydown', this.handleKeyDown.bind(this));
        }
    }

    render() {
        let tools: JSX.Element | null = null;
        if (this.state.room && this.state.user) {
            tools = (
                <span className={'right'}>
                    <TunnelTool
                        room={this.state.room}
                        ref={(tool) => {this.tunnelTool = tool; }}
                    />
                    <TextTool
                        room={this.state.room}
                        ref={(tool) => {this.textTool = tool; }}
                    />
                    <ConfigTool
                        room={this.state.room}
                        ref={(tool) => {this.configTool = tool; }}
                    />
                    <StyleTool
                        room={this.state.room}
                        ref={(tool) => {this.styleTool = tool; }}
                    />
                    <HomeTool
                        room={this.state.room}
                        rootRoomId={this.state.rootRoomId}
                        ref={(tool) => {this.homeTool = tool; }}
                    />
                    <InfoTool/>
                    <UserTool user={this.state.user}/>
                </span>
            );
        }

        const subtitle = this.state.room ? this.state.room.title : '...';
        return (
            <div id={'Toolbar'}>
                <span id={'Title'}>
                    mazenet
                </span><span title={`In the room '${subtitle}'`} id={'Subtitle'}>
                    {subtitle}
                </span>
                {tools}
            </div>
        );
    }

    private handleKeyDown(event: KeyboardEvent) {
        // TODO: Fix event propagation.
        if (event.key) {
            return; // Always return, don't execute below.
        }
        switch (event.key) {
            case 't':
                if (this.tunnelTool) {this.tunnelTool.Use(); }
                break;
            case 'w':
                if (this.textTool) {this.textTool.Use(); }
                break;
            case 'c':
                if (this.configTool) {this.configTool.Use(); }
                break;
            case 'r':
                if (this.homeTool) {this.homeTool.Use(); }
                break;
            case 's':
                if (this.styleTool) {this.styleTool.Use(); }
                break;
            default:
                break;
        }
    }
}