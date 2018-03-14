import * as Express from 'express';
import 'rxjs/add/observable/forkJoin';
import { Observable } from 'rxjs/Observable';

import FreshSocketIO = require('fresh-socketio-router');
import * as Api from '../../../common/api';
import * as Validator from '../../../common/util/validator';
import { BadRequestError, Request, Response, Socket, UnauthorizedError } from '../common';

import { Room } from '../room/models';
import { Service as RoomService } from '../room/service';
import { ActiveUser, User } from './models';
import { Service } from './service';

// temporary imports, won't be needed later
import * as Uuid from 'uuid/v4';

export class Middleware {

    public service: Service;
    public roomService: RoomService;
    /** Universal router that can be used in express or fresh-socketio-router */
    public router: Express.Router;
    public socketMiddleware: (socket: Socket, fn: ( err?: any ) => void ) => void;

    constructor(service: Service, roomService: RoomService) {
        this.service = service;
        this.roomService = roomService;

        this.socketMiddleware = (socket: Socket, next: (err?: any) => void) => {
            //TODO: authenticate based on JWT
            socket.mazenet = {
                sessionId: socket.id
            };

            socket.on('disconnect', () => {
                this.service.onUserDisconnect(socket.mazenet!.sessionId);
            });
            next();
        };
        this.router = Express.Router();
        this.router.use((req: Request, res: Response, next: Express.NextFunction) => {
            if((req.socket as Socket).mazenet) {
                // this is a socketio connection
                //TODO: do we need to validate that activeUser is valid for this user?
                req.activeUser = this.service.getActiveUserFromSession((req.socket as Socket).mazenet!.sessionId);
                if(!(req.socket as Socket).mazenet!.user) {
                    this.service.createUser({username: 'anonymous'}).subscribe((user) => {
                        (req.socket as Socket).mazenet!.user = user;
                        req.user = user;
                        return next();
                    });
                } else {
                    req.user = (req.socket as Socket).mazenet!.user;
                    return next();
                }
            } else {
                //TODO: authenticate based on JWT
                this.service.createUser({username: 'anonymous'}).subscribe((user) => {
                    req.user = user;
                    return next();
                });
            }
        });

        const usersRouter = Express.Router();
        usersRouter.post('/connect', (req: Request, res: Response, next: Express.NextFunction) => {
            if(!(req.socket as Socket).mazenet) {
                throw new BadRequestError('Only websocket sessions can /connect to the Mazenet');
            }
            if(!req.user) {
                throw new UnauthorizedError('User must be logged in');
            }
            let body: Api.v1.Models.PlatformData;
            try {
                body = Validator.validateData(req.body, Api.v1.Routes.Users.Connect.Post.Request.Desktop, 'body');
            } catch (err) {
                throw new BadRequestError(err.message);
            }

            // TODO: make this wait for user insert to complete
            Observable.forkJoin(
                this.service.createActiveUser((req.socket as Socket).mazenet!.sessionId, req.user, body),
                this.roomService.getRootRoomId())
            .subscribe(([activeUser, rootRoomId]) => {
                (req.socket as Socket).mazenet!.activeUser = activeUser;
                const response: Api.v1.Routes.Users.Connect.Post.Response200 = {
                    activeUser: activeUser.toV1(),
                    rootRoomId,
                };
                return res.status(200).json(response);
            }, (err: Error) => {
                next(err);
            });
        });

        this.router.use('/users', usersRouter);
    }
}
