import { Observable } from 'rxjs/Observable';

import { AlreadyExistsError } from '../../common';
import { ActiveUser, User } from '../models';

import { InMemoryDataStore } from './in-memory';
import { PostgresDataStore } from './postgres';

interface DataStore {
    getUser: (userId: User.Id) => Observable<User>;
    insertUser: (user: User) => Observable<User>;

    getActiveUser: (activeUserId: ActiveUser.Id) => Observable<ActiveUser>;
    insertActiveUser: (activeUser: ActiveUser) => Observable<ActiveUser>;

    getRootUserId: () => Observable<User.Id>;
    setRootUserId: (userId: User.Id) => Observable<null>;
}

interface SessionDataStore {
    /** local store, return immediately */
    getActiveUserFromSession: (sessionId: string) => ActiveUser | undefined;
    insertActiveUserFromSession: (sessionId: string, activeUser: ActiveUser) => ActiveUser;
    deleteActiveUserFromSession: (sessionId: string) => void;
    getSessionFromActiveUser: (activeUserId: ActiveUser.Id) => string | undefined;
}

class SimpleSessionDataStore implements SessionDataStore {
    public sessionActiveUsers: Map<string, ActiveUser>;
    public activeUserSessions: Map<ActiveUser.Id, string>;

    constructor() {
        this.sessionActiveUsers = new Map<string, ActiveUser>();
        this.activeUserSessions = new Map<ActiveUser.Id, string>();
    }

    public getActiveUserFromSession(sessionId: string) {
        return this.sessionActiveUsers.get(sessionId);
    }

    public insertActiveUserFromSession(sessionId: string, activeUser: ActiveUser) {
        if(this.sessionActiveUsers.has(sessionId)) {
            throw new AlreadyExistsError(`Session '${sessionId}' already has an ActiveUser`);
        }

        this.sessionActiveUsers.set(sessionId, activeUser);
        this.activeUserSessions.set(activeUser.id, sessionId);
        return activeUser;
    }

    public deleteActiveUserFromSession(sessionId: string) {
        const activeUser = this.sessionActiveUsers.get(sessionId);
        if(activeUser) {
            this.activeUserSessions.delete(activeUser.id);
        }
        this.sessionActiveUsers.delete(sessionId);
    }

    public getSessionFromActiveUser(activeUserId: ActiveUser.Id) {
        return this.activeUserSessions.get(activeUserId);
    }
}

export {
    DataStore,
    SessionDataStore,
    SimpleSessionDataStore,
    InMemoryDataStore,
    PostgresDataStore,
};
