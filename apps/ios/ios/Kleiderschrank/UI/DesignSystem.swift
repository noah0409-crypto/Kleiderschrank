import SwiftUI

enum AppPalette {
    static let background = Color(red: 0.08, green: 0.09, blue: 0.11)
    static let backgroundElevated = Color(red: 0.12, green: 0.13, blue: 0.16)
    static let panel = Color(red: 0.15, green: 0.16, blue: 0.19)
    static let panelSoft = Color(red: 0.18, green: 0.20, blue: 0.24)
    static let lightCard = Color(red: 0.97, green: 0.97, blue: 0.95)
    static let textPrimary = Color.white
    static let textSecondary = Color(red: 0.67, green: 0.70, blue: 0.75)
    static let textDark = Color(red: 0.08, green: 0.09, blue: 0.11)
    static let border = Color.white.opacity(0.09)
}

struct AppSectionCard<Content: View>: View {
    let eyebrow: String
    let title: String
    var light: Bool = false
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(eyebrow.uppercased())
                    .font(.system(size: 12, weight: .bold))
                    .tracking(1.2)
                    .foregroundStyle(light ? Color.gray : AppPalette.textSecondary)
                Text(title)
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(light ? AppPalette.textDark : AppPalette.textPrimary)
            }

            content
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(light ? AppPalette.lightCard : AppPalette.panel)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(light ? Color.black.opacity(0.06) : AppPalette.border, lineWidth: 1)
        )
    }
}

struct AppButtonStyle: ButtonStyle {
    let primary: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 15, weight: .bold))
            .foregroundStyle(primary ? AppPalette.textDark : AppPalette.textPrimary)
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .background(primary ? AppPalette.lightCard : AppPalette.panelSoft)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(primary ? Color.clear : AppPalette.border, lineWidth: 1)
            )
            .opacity(configuration.isPressed ? 0.85 : 1)
    }
}

struct PillView: View {
    let title: String
    let selected: Bool
    let light: Bool

    var body: some View {
        Text(title)
            .font(.system(size: 13, weight: .bold))
            .foregroundStyle(selected ? (light ? AppPalette.textPrimary : AppPalette.textDark) : (light ? AppPalette.textDark : AppPalette.textPrimary))
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(selected ? (light ? AppPalette.textDark : AppPalette.lightCard) : (light ? Color.white : AppPalette.panelSoft))
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(light ? Color.black.opacity(0.08) : AppPalette.border, lineWidth: 1)
            )
    }
}

struct MetricBadge: View {
    let value: Int
    let label: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("\(value)")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(AppPalette.textPrimary)
            Text(label)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(AppPalette.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(AppPalette.backgroundElevated)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(AppPalette.border, lineWidth: 1)
        )
    }
}
