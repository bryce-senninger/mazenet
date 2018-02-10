import {Observable} from 'rxjs';
import 'rxjs/add/observable/forkJoin';
import 'rxjs/add/operator/toPromise';
import 'rxjs/add/operator/mergeMap';

import * as Http from 'http';
import * as SocketIOClient from 'socket.io-client';

import {Server} from '../src/server';
import * as Api from '../../common/api';
import {GlobalLogger, LoggerHandler} from '../src/util/logger';

interface Request {
    route: string;
    method: string;
    headers?: {[name: string]: string};
    body: any;
}

interface Response {
    status: number;
    headers: {[name: string]: string};
    body: any;
}

/** Connects a SocketIO client and records request/response for each transaction. Provides helper functions for issuing and validating transactions
 * user and activeUser properties are automatically set after using connectSocket() or connectAndEnter()
 * */
class Client {
    client: SocketIOClient.Socket;
    /** transaction history */
    transactions: [Request, Response][];
    /** last request */
    req: Request;
    /** last response */
    res: Response;
    //user?: Api.v1.Models.User;
    activeUser?: Api.v1.Models.ActiveUser;


    constructor(baseUrl: string) {
        this.client = SocketIOClient(baseUrl);
        this.transactions = [];
    }

    emitTransaction(method: string, route: string, body: any): Observable<Client> {
        let request: Request = {route, method, body};
        let obs: Observable<Response> = Observable.fromEvent(this.client, route);
        this.client.emit(route, {
            method: method,
            body: body
        });
        return Observable.forkJoin(Observable.of(request), obs.first())
        .map(([req, res]: [Request, Response]) => {
            this.transactions.push([req, res]);
            this.req = req;
            this.res = res;
            return this;
        });
    }

    /** Handle initial /users/connect call */
    connectSocket(): Observable<Client> {
        return this.emitTransaction('POST', '/users/connect',
            {
                pType: 'desktop',
                cursorPos: {
                    x: 0.5,
                    y: 0.5,
                }
            }
        ).map((client) => {
            expect(client.res.status).toBe(200);
            expect(typeof client.res.body.activeUser).toBe('object');
            this.activeUser = client.res.body.activeUser;
            return client;
        });
    }

    /** Handle initial /users/connect then /rooms/enter the root room */
    connectAndEnter(): Observable<Client> {
        return this.connectSocket().mergeMap((client) => {
            return this.emitTransaction('POST', '/rooms/enter', {id: client.res.body.rootRoomId});
        }).map((client) => {
            expect(client.res.status).toBe(200);
            return client;
        });
    }
}

let server: Server;
let baseUrl: string;

// disable all non-error console output
GlobalLogger.handlers.forEach((handler: LoggerHandler, level: string) => {
    if(level !== 'error') {
        handler.enabled = false;
    }
});

beforeEach(() => {
    server = new Server({
        port: 0,
        securePort: 0,
        //sslCertPath: '',
        env: 'test'
    });
    return server.start().map(() => {
        let protocol = server.usingSsl ? 'https' : 'http';
        baseUrl = `${protocol}://127.0.0.1:${server.httpServer.address().port}/mazenet`;
    }).toPromise();
});

describe('users', () => {
    test('POST /connect', () => {
        let client = new Client(baseUrl);

        return client.connectSocket().map(() => {
            let res = client.res;
            expect(res.status).toBe(200);
            expect(typeof res.body.rootRoomId).toBe('string');
            expect(typeof res.body.activeUser.id).toBe('string');
            expect(typeof res.body.activeUser.userId).toBe('string');
            expect(typeof res.body.activeUser.username).toBe('string');
            expect(res.body.activeUser.platformData).toEqual({
                pType: 'desktop',
                cursorPos: {
                    x: 0.5,
                    y: 0.5,
                }
            });
        }).first().toPromise();
    });
});

describe('rooms', () => {
    test('POST /enter', () => {
        let client = new Client(baseUrl);

        return client.connectAndEnter().map(() => {
            let res = client.res;
            expect(res.status).toBe(200);
            // room
            expect(typeof res.body.room.id).toBe('string');
            expect(typeof res.body.room.creator).toBe('string');
            expect(typeof res.body.room.title).toBe('string');
            expect(typeof res.body.room.stylesheet).toBe('string');

            expect(Array.isArray(res.body.room.owners)).toBe(true);
            expect(res.body.room.owners).toHaveLength(1);

            // structure
            expect(Object.keys(res.body.room.structures)).toHaveLength(1);
            let enterTunnel = res.body.room.structures[Object.keys(res.body.room.structures)[0]];
            expect(typeof enterTunnel.id).toBe('string');
            expect(typeof enterTunnel.creator).toBe('string');
            expect(enterTunnel.pos).toEqual({x: 0.5, y: 0.5});
            expect(enterTunnel.data.sType).toBe('tunnel');
            expect(enterTunnel.data.sourceId).toBe(res.body.room.id);
            expect(typeof enterTunnel.data.targetId).toBe('string');
            expect(typeof enterTunnel.data.sourceText).toBe('string');
            expect(typeof enterTunnel.data.targetId).toBe('string');

            // users
            expect(res.body.users).toBeDefined();
            expect(typeof res.body.users).toBe('object');
            expect(Object.keys(res.body.users)).toHaveLength(0);
        }).first().toPromise();
    });

    describe('structures', () => {
        describe('tunnel', () => {
            test('POST /create', () => {
                let client = new Client(baseUrl);
                return client.connectAndEnter().mergeMap(() => {
                    let res = client.res;
                    return client.emitTransaction('POST', '/rooms/structures/create', {
                        roomId: res.body.room.id,
                        structure: {
                            pos: {x: 0.1, y: 0.1},
                            data: {
                                sType: 'tunnel',
                                sourceText: 'the hills',
                                targetText: 'mazenet'
                            }
                        }
                    });
                }).mergeMap(() => {
                    let res = client.res;
                    expect(res.status).toBe(201);
                    expect(typeof res.body.id).toBe('string');
                    expect(res.body.creator).toBe(client.activeUser!.userId);
                    expect(res.body.pos).toEqual({x: 0.1, y: 0.1});
                    expect(res.body.data.sType).toBe('tunnel');
                    expect(res.body.data.sourceId).toBe(client.req.body.roomId);
                    expect(typeof res.body.data.targetId).toBe('string');
                    expect(res.body.data.sourceText).toBe('the hills');
                    expect(res.body.data.targetText).toBe('mazenet');

                    // ensure the target room can be entered
                    return client.emitTransaction('POST', '/rooms/enter', {id: res.body.data.targetId});
                }).map(() => {
                    let res = client.res;
                    expect(res.status).toBe(200);

                    // room
                    expect(res.body.room.creator).toBe(client.activeUser!.userId);
                    expect(res.body.room.title).toBe('the hills');

                    expect(Array.isArray(res.body.room.owners)).toBe(true);
                    expect(res.body.room.owners).toHaveLength(1);
                    expect(res.body.room.owners).toContain(client.activeUser!.userId);

                    // structure
                    expect(Object.keys(res.body.room.structures)).toHaveLength(1);
                    let tunnel = res.body.room.structures[Object.keys(res.body.room.structures)[0]];
                    expect(tunnel.id).toBe(client.transactions[2][1].body.id);
                }).first().toPromise();
            });
        });
    });
});