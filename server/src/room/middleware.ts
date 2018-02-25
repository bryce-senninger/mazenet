import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';
import 'rxjs/add/observable/forkJoin';
import 'rxjs/add/operator/mergeMap';
import * as Express from 'express';
import * as SocketIO from 'socket.io';

import FreshSocketIO = require('fresh-socketio-router');
import * as Validator from '../../../common/util/validator';
import * as Api from '../../../common/api';
import {GlobalLogger} from '../util/logger';

import { Request, Response, Socket, BadRequestError, UnauthorizedError, ConflictError, mapToObject } from '../common';
import { Service } from './service';
import { RoomDocument, Room, Structure, ActiveUserRoomData, RoomEvent, EnterRoomEvent, ExitRoomEvent, StructureCreateEvent} from './models';
import { User, ActiveUser } from '../user/models';

import {CursorRecording, CursorEvent, CursorMoveEvent} from '../cursor-recording/models';
import {Service as UserService} from '../user/service';
import {Service as CursorService} from '../cursor-recording/service';

// temporary imports, won't be needed later
import * as Uuid from 'uuid/v4';

export class Middleware {

    service: Service;
    userService: UserService;
    cursorService: CursorService;
    socketNamespace: SocketIO.Namespace;
    /** Universal router that can be used in express or fresh-socketio-router */
    router: Express.Router;
    socketMiddleware: (socket: Socket, fn: (err?: any) => void) => void;

    constructor(service: Service, userService: UserService, cursorService: CursorService, socketNamespace: SocketIO.Namespace) {
        this.service = service;
        this.userService = userService;
        this.cursorService = cursorService;
        this.socketNamespace = socketNamespace;

        // NOTE: consider adding a way to unsubscribe
        service.events.filter((event) => event.event === 'enter').subscribe((event) => this.onEnterRoom(<EnterRoomEvent>event));
        service.events.filter((event) => event.event === 'exit').subscribe((event) => this.onExitRoom(<ExitRoomEvent>event));
        service.events.filter((event) => event.event === 'structure-create').subscribe((event) => this.onCreateStructure(<StructureCreateEvent>event));
        cursorService.events.filter((event) => event.event === 'move').subscribe((event) => this.onCursorMoved(<CursorMoveEvent>event));
        this.router = this.makeRouter();
        this.socketMiddleware = this.makeSocketMiddleware();
    }

    makeSocketMiddleware() {
        return (socket: Socket, next: (err?: any) => void) => {
            socket.on('disconnect', () => {
                if(socket.mazenet!.activeUser) {
                    this.service.exitRoom(socket.mazenet!.activeUser!.id).subscribe(() => {
                    }, (err: Error) => {
                        GlobalLogger.error('ActiveUser failed to exit room on disconnect', {activeUser: socket.mazenet!.activeUser});
                    });
                }
            });

            socket.on('/rooms/active-users/desktop/cursor-moved', (data: any) => {
                let body: Api.v1.Events.Client.Rooms.ActiveUsers.Desktop.CursorMoved;
                try {
                    body = Validator.validateData(
                        data,
                        Api.v1.Events.Client.Rooms.ActiveUsers.Desktop.CursorMoved,
                        'body');
                }
                catch(err) {
                    //TODO: standardize event logging
                    GlobalLogger.request('event-error', {
                        code: 400,
                        message: err.message,
                        route: '/rooms/active-users/desktop/cursor-moved'
                    });
                    return;
                }

                if(!socket.mazenet!.activeUser) {
                    //TODO: standardize event logging
                    GlobalLogger.request('event-error', {
                        code: 409,
                        message: 'Client does not have active user',
                        route: '/rooms/active-users/desktop/cursor-moved'
                    });
                    return;
                }

                return this.service.getActiveUserRoomData(socket.mazenet!.activeUser!.id)
                .mergeMap((activeUserRoomData) => {
                    if(activeUserRoomData) {
                        return this.cursorService.onCursorMoved(activeUserRoomData, body.pos);
                    }
                    else {
                        return Observable.of(null);
                    }
                }).subscribe(() => {
                    //TODO: standardize event logging
                    GlobalLogger.request('event-complete', {
                        code: 200,
                        route: '/rooms/active-users/desktop/cursor-moved'
                    });
                }, (err: any) => {
                    //TODO: standardize event logging
                    let errorOut = {
                        code: err.httpCode || 500,
                        message: err.message,
                        data: Object.keys(err).reduce((o: any, p: string) => {
                            o[p] = err[p];
                            return o;
                        }, {})
                    };

                    if (errorOut.code >= 500) {
                        GlobalLogger.error(`Unhandled ${err.constructor.name} in request handler'`, {
                            errorType: err.constructor.name,
                            message: err.message,
                            stack: err.stack,
                            data: errorOut.data
                        });
                    }

                    GlobalLogger.request('event-error', Object.assign(errorOut, {
                        route: '/rooms/active-users/desktop/cursor-moved'
                    }));
                });
            });
            next();
        };

    }

    makeRouter(): Express.Router {
        let router = Express.Router();

        let roomsRouter = Express.Router();
        roomsRouter.post('/enter', (req: Request, res: Response, next: Express.NextFunction) => {
            if(!(<Socket>req.socket).mazenet) {
                throw new BadRequestError('Only websocket sessions can /enter the Mazenet');
            }

            if(!(<Socket>req.socket).mazenet!.activeUser) {
                throw new ConflictError('No ActiveUser. You must `POST /users/connect` before you can enter a room');
            }

            let body: Api.v1.Routes.Rooms.Enter.Post.Request;
            try {
                body = Validator.validateData(req.body, Api.v1.Routes.Rooms.Enter.Post.Request, 'body');
            }
            catch(err) {
                throw new BadRequestError(err.message);
            }

            return Observable.forkJoin(
                this.service.getRoom(body.id),
                this.service.getActiveUsersInRoom(body.id)
            ).mergeMap(([room, activeUsers]) => {
                // enter room after getting the room and active users
                return Observable.forkJoin(
                    this.service.getRoomDocument(room),
                    Observable.of(activeUsers),
                    this.service.enterRoom(body.id, (<Socket>req.socket).mazenet!.activeUser!));
            }).subscribe(([roomDoc, activeUsers]) => {
                //(<Socket>req.socket).emit('/rooms/active-users/entered', (<Socket>req.socket).mazenet!.activeUser);
                let response: Api.v1.Routes.Rooms.Enter.Post.Response200 = {
                    room: roomDoc.toV1(),
                    users: mapToObject(activeUsers, (a: ActiveUserRoomData) => a.activeUser.toV1())
                };
                return res.status(200).json(response);
            }, (err: Error) => {
                return next(err);
            });
        });

        roomsRouter.post('/structures/create', (req: Request, res: Response, next: Express.NextFunction) => {
            if(!req.user) {
                // should this error never occur/be 500? (unauthenticated user is given unique anonymous user data)
                throw new UnauthorizedError('You must be authenticated to create a structure');
            }
            let body: Api.v1.Routes.Rooms.Structures.Create.Post.Request;
            try {
                body = Validator.validateData(req.body, Api.v1.Routes.Rooms.Structures.Create.Post.Request, 'body');
            }
            catch(err) {
                throw new BadRequestError(err.message);
            }
            return this.service.createStructure(req.user, body.roomId, body.structure).subscribe((structure) => {
                return res.status(201).json(structure.toV1());
            }, (err: Error) => {
                return next(err);
            });
        });

        roomsRouter.get('/cursor-recordings', (req: Request, res: Response, next: Express.NextFunction) => {
            let body: Api.v1.Routes.Rooms.CursorRecordings.Get.Request;
            try {
                body = Validator.validateData(req.body, Api.v1.Routes.Rooms.CursorRecordings.Get.Request, 'body');
            }
            catch(err) {
                throw new BadRequestError(err.message);
            }

            return this.cursorService.getCursorRecordings(body.roomId, body.limit || 0).subscribe((cursorRecordings) => {
                let response = {
                    cursorRecordings: mapToObject(cursorRecordings)
                };
                return res.status(200).json(response);
            }, (err: Error) => {
                return next(err);
            });
        });

        router.use('/rooms', roomsRouter);
        return router;
    }

    onEnterRoom(event: EnterRoomEvent) {
        let data: Api.v1.Events.Server.Rooms.ActiveUsers.Entered = event.activeUser.toV1();
        this.emitToSocketsInRoom(event.roomId, '/rooms/active-users/entered', data).subscribe();
    }

    onExitRoom(event: ExitRoomEvent) {
        let data: Api.v1.Events.Server.Rooms.ActiveUsers.Exited = event.activeUser.toV1();
        this.emitToSocketsInRoom(event.roomId, '/rooms/active-users/exited', data).subscribe();
    }

    onCursorMoved(event: CursorMoveEvent) {
        let data: Api.v1.Events.Server.Rooms.ActiveUsers.Desktop.CursorMoved = {
            activeUserId: event.activeUser.id,
            pos: event.pos
        };
        this.emitToSocketsInRoom(event.roomId, '/rooms/active-users/desktop/cursor-moved', data).subscribe();
    }

    onCreateStructure(event: StructureCreateEvent) {
        let data: Api.v1.Events.Server.Rooms.Structures.Created = event.structure.toV1();
        this.emitToSocketsInRoom(event.roomId, '/rooms/structures/created', data).subscribe();
    }

    private emitToSocketsInRoom(roomId: Room.Id, route: string, data: any) {
        return this.service.getActiveUsersInRoom(roomId).map((activeUsers) => {
            for(let [activeUserId, activeUserRoomData] of activeUsers) {
                let userSocketId = this.userService.getSessionFromActiveUser(activeUserId);
                if(userSocketId) {
                    this.socketNamespace.to(userSocketId).emit(route, data);
                }
            }
        });
    }
}

