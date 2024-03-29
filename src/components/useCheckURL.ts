import { useEffect, useState, Dispatch, SetStateAction } from 'react';
import { useApi } from '../api';
import { useLocalStorageKeystore } from '../services/LocalStorageKeystore';


function useCheckURL(urlToCheck: string): {
	isValidURL: boolean | null,
	showPopup: boolean,
	setShowPopup: Dispatch<SetStateAction<boolean>>,
	setSelectedValue: Dispatch<SetStateAction<string | null>>,
	conformantCredentialsMap: any,
} {
	const api = useApi();
	const isLoggedIn: boolean = api.isLoggedIn();
	const [isValidURL, setIsValidURL] = useState<boolean | null>(null);
	const [showPopup, setShowPopup] = useState<boolean>(false);
	const [selectedValue, setSelectedValue] = useState<string | null>(null);
	const [conformantCredentialsMap, setConformantCredentialsMap] = useState(null);
	const keystore = useLocalStorageKeystore();

	useEffect(() => {

		async function handlePreAuthorizeAskForPin(url: string): Promise<boolean> {
			const u = new URL(url);
			const preauth = u.searchParams.get('preauth');
			if (preauth && preauth == 'true') {
				try {
					await api.post('/issuance/request/credentials/with/pre_authorized', { user_pin: "" });
				}
				catch(err) {
					console.log(err);
				}
				return true;
			}
			return false;
		}

		async function handlePreAuthorizedCredentialOffer(url: string): Promise<boolean> {
			try {
				const result = await api.post('/issuance/generate/authorization/request/with/offer', { credential_offer_url: url });
				const { redirect_to } = result.data;
				console.log("preauth redirect to = ", redirect_to);
				const u = new URL(redirect_to);
				const preauth = u.searchParams.get('preauth');
				console.log("U = ", u)
				if (preauth && preauth == 'true') {
					await api.post('/issuance/request/credentials/with/pre_authorized', { user_pin: "" });
					return true;
				}
			}
			catch(err) {
				console.log(err);
			}
			return false;
		}

		async function handleAuthorizationRequest(url: string): Promise<boolean> {
			const wwwallet_camera_was_used = new URL(url).searchParams.get('wwwallet_camera_was_used');

			try {
				const response = await api.post(
					"/presentation/handle/authorization/request",
					{ authorization_request: url, camera_was_used: (wwwallet_camera_was_used && wwwallet_camera_was_used === 'true') },
				);


				console.log("Data = ", response.data)
				const { redirect_to, conformantCredentialsMap, verifierDomainName } = response.data;
				if (redirect_to) {
					window.location.href = redirect_to; // Navigate to the redirect URL
				} else {
					console.log('need action');
					const firstValue = Object.values(conformantCredentialsMap)[0];
					console.log("first value = ", firstValue)

					setConformantCredentialsMap(firstValue);
					setShowPopup(true);
					console.log("called setShowPopup")
					return true;
				}
				return true;

			} catch (e) {
				return false;
			}
		};

		async function handleAuthorizationResponse(url: string): Promise<boolean> {
			try {
				const response = await api.post(
					"/issuance/handle/authorization/response",
					{ authorization_response_url: url },
				);
				console.log("handleAuthorizationResponse:", response);
				return true;

			} catch (e) {
				console.log("Failed handleAuthorizationResponse:", e);
				return false;
			}
		}

		if (urlToCheck && isLoggedIn && window.location.pathname==="/cb") {
			(async () => {
				const isRequestHandled = await handleAuthorizationRequest(urlToCheck);
				const isResponseHandled = await handleAuthorizationResponse(urlToCheck);
				const isPreAuthorizedFlowHandled = await handlePreAuthorizeAskForPin(urlToCheck);
				const isPreAuthorizedCredentialOffer = await handlePreAuthorizedCredentialOffer(urlToCheck);

				if (isRequestHandled || isResponseHandled || isPreAuthorizedFlowHandled || isPreAuthorizedCredentialOffer) {
					setIsValidURL(true);
				} else {
					setIsValidURL(false);
				}
			})();
		}
	}, [api, keystore, urlToCheck, isLoggedIn]);

	useEffect(() => {
		if (selectedValue) {
			console.log(selectedValue);

			api.post("/presentation/generate/authorization/response",
				{ verifiable_credentials_map: { title: "VC Selection", selectedValue } },
			).then(success => {
				console.log(success);
				const { redirect_to } = success.data;
				if (redirect_to)
					window.location.href = redirect_to; // Navigate to the redirect URL
			});
		}
	}, [api, keystore, selectedValue]);

	return { isValidURL, showPopup, setShowPopup, setSelectedValue, conformantCredentialsMap };
}

export default useCheckURL;
