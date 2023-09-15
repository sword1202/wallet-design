import { useMemo } from "react";


async function openIndexedDb(
	dbName: string,
	version: number,
	upgrade: (db: IDBDatabase, prevVersion: number, newVersion: number) => void,
): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = window.indexedDB.open(dbName, version);
		request.onsuccess = () => resolve(request.result);
		request.onerror = (event) => reject(event);
		request.onupgradeneeded = (event) => {
			upgrade(request.result, event.oldVersion, event.newVersion);
		};
	});
}

async function dbTransaction(db: IDBDatabase, objectStores: string[], mode: IDBTransactionMode, f: (transaction: IDBTransaction) => IDBRequest): Promise<void> {
	const tr = db.transaction(objectStores, mode);
	return await new Promise((resolve, reject) => {
		const req = f(tr);
		req.onsuccess = () => resolve(req.result);
		req.onerror = (event) => reject(event);
	});
}

export type DatabaseTransaction = (objectStores: string[], f: (transaction: IDBTransaction) => IDBRequest) => Promise<any>;

export function useIndexedDb(
	dbName: string,
	version: number,
	upgrade: (db: IDBDatabase, prevVersion: number, newVersion: number) => void,
): { read: DatabaseTransaction, write: DatabaseTransaction, destroy: () => Promise<void>} {
	return useMemo(
		() => {
			const openDb = async () => await openIndexedDb(dbName, version, upgrade);

			const read: DatabaseTransaction = async (objectStores, f): Promise<any> => {
				return await dbTransaction(await openDb(), objectStores, "readonly", f);
			};
			const write: DatabaseTransaction = async (objectStores, f): Promise<any> => {
				return await dbTransaction(await openDb(), objectStores, "readwrite", f);
			};
			const destroy = async (): Promise<void> => {
				return new Promise((resolve, reject) => {
					const request = window.indexedDB.deleteDatabase(dbName);
					request.onsuccess = () => resolve();
					request.onerror = (event) => reject(event);
				});
			}

			return { read, write, destroy };
		},
		[dbName, version, upgrade],
	);
}