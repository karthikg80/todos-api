import Foundation
import Security

struct TokenStorage {
    private static let accessTokenKey = "com.todosapp.accessToken"
    private static let refreshTokenKey = "com.todosapp.refreshToken"

    var accessToken: String? { read(key: Self.accessTokenKey) }
    var refreshToken: String? { read(key: Self.refreshTokenKey) }

    func storeSession(access: String, refresh: String) {
        write(key: Self.accessTokenKey, value: access)
        write(key: Self.refreshTokenKey, value: refresh)
    }

    func storeAccessToken(_ token: String) {
        write(key: Self.accessTokenKey, value: token)
    }

    func clearAll() {
        delete(key: Self.accessTokenKey)
        delete(key: Self.refreshTokenKey)
    }

    private func write(key: String, value: String) {
        guard let data = value.data(using: .utf8) else { return }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
        ]
        let attributes: [String: Any] = [kSecValueData as String: data]
        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var newItem = query
            newItem[kSecValueData as String] = data
            SecItemAdd(newItem as CFDictionary, nil)
        }
    }

    private func read(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
