module.exports.subject = "Charge-Angels - <%- subject %>";
module.exports.html = `
<html>
	<body align="center" bgcolor="cadetblue" background="https://cloud.charge-angels.fr/assets/img/charge-angels-bg.jpg" style="margin: 15px;">
		<center>
			<!-- Header -->
			<table width="768" border="0" cellspacing="0" cellpadding="0">
				<tr style="background-color: #356964;background: linear-gradient(to right, rgba(53,105,100,1) 0%,rgba(53,105,100,1) 62%,rgba(107,173,167,1) 100%);">
					<td>
						<table width="768" border="0" cellspacing="0" cellpadding="0">
							<tr height="70">
								<td width="180" align="center">
									<center><img width="150" height="50" alt="Logo" src="https://cloud.charge-angels.fr/assets/img/angel-wings-low.gif"></center>
								</td>
								<td align="center" style="border-color:white;border-width: 2px;border-left-style: solid;border-right-style: solid;">
									<font size="5" color="white" face="sans-serif"><b><%- body.header.title %></b></font>
								</td>
								<td width="180" align="center">
									<img width="<%- body.header.image.width %>"
										height="<%- body.header.image.height %>" alt="Info"
										src="<%- (body.header.image.url ? body.header.image.url : body.header.image.content) %>">
								</td>
							</tr>
						</table>
					</td>
				</tr>
			</table>
			<!-- Content -->
			<table width="768" bgcolor="white" border="0" cellspacing="0" cellpadding="0">
				<!-- Before Action -->
				<tr><td colspan="3" style="padding: 10px 0;">&nbsp;</td></tr>
				<% for (var i = 0; i < body.beforeActionLines.length; i++) { %>
					<tr>
						<td colspan="3" style="padding: 5px 0 0 20px;">
							<font size="4" face="sans-serif">
								<%- body.beforeActionLines[i] %>&nbsp;
							</font>
						</td>
					</tr>
				<% } %>
				<!-- Action -->
				<% if (body.action) { %>
					<tr><td colspan="3" style="padding: 10px 0;">&nbsp;</td></tr>
					<tr>
						<td style="width: 30%;"></td>
						<td align="center" height="50" style="background-color: #356964;border-radius: 10px;">
							<a style="text-decoration:none;" href="<%- body.action.url %>" target="_blank">
								<font size="4" color="white" face="sans-serif">
									<b><%- body.action.title %></b>
								</font>
							</a>
						</td>
						<td style="width: 30%;"></td>
					</tr>
					<tr><td colspan="3" style="padding: 10px 0;">&nbsp;</td></tr>
				<% } %>
				<!-- After Action -->
				<% for (var i = 0; i < body.afterActionLines.length; i++) { %>
					<tr>
						<td colspan="3" style="padding: 5px 0 0 20px;">
							<font size="4" face="sans-serif">
								<%- body.afterActionLines[i] %>&nbsp;
							</font>
						</td>
					</tr>
				<% } %>
				<tr><td colspan="3" style="padding: 10px 0;">&nbsp;</td></tr>
			</table>
			<!-- Footer -->
			<table width="768" border="0" cellspacing="0" cellpadding="0">
				<tr height="40" style="background-color: #356964;background: linear-gradient(to right, rgba(107,173,167,1) 0%,rgba(53,105,100,1) 38%,rgba(53,105,100,1) 100%);">
					<td align="right" colspan="3" style="padding: 0 15px">
						<a style="text-decoration:none;" href="http://chargeangels.fr/" target="_blank">
							<font size="3" color="white" face="sans-serif"><i>Charge-Angels</i></font>
						</a>
					</td>
				</tr>
			</table>
		</center>
	</body>
</html>
`;
